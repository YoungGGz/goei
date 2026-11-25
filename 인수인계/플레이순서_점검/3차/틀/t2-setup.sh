#!/usr/bin/env bash
# T2 틀(실제 리스AI + 괴이 release + 가짜 모델 서버)을 새 컨테이너에서 한 번에 세운다. (3차 코스 2-2 · 8장)
#
#   bash t2-setup.sh            받기·설치·빌드 → 가짜 서버·리스AI vite dev·조종 서버를 백그라운드로 띄우고 주소를 찍는다
#   bash t2-setup.sh --check    위 + 끝에 risu-t2.mjs check (PC 1280x800, --via plain) 한 번
#   bash t2-setup.sh stop       이 스크립트가 띄운 것(같은 T2_HOME 의 pids)만 끈다
#
# 환경 (모두 고를 수 있음):
#   T2_HOME       작업 폴더. 기본 /tmp/t2  (pids·로그·t2-env.sh 를 여기 둔다)
#   RISU_DIR      리스AI 원본을 받을 곳. 기본 $T2_HOME/risu-src
#   T2_RISU_PORT  리스AI vite dev 포트 (기본 5180)   ┐ 쓰이고 있으면 다음 빈 포트로 옮기고 찍는다
#   T2_FAKE_PORT  가짜 모델 서버 포트 (기본 8790)     │
#   T2_CTL_PORT   조종 서버 포트 (기본 7101)          ┘
#   T2_VIA        조종 서버 길 plain|proxy2 (기본 plain)
#   T2_FAKE_LOG   가짜 서버 기록 파일 (기본 틀/out/fake-llm.jsonl)
#   T2_SKIP_BUILD=1  release/ 가 이미 있으면 npm ci·release:prep 건너뜀
#   T2_PREP_TESTS=1  release:prep 의 ⑤(형 검사·단위 시험)도 돌림 (기본은 --skip-tests)
#
# 가짜 서버 주소를 고르는 까닭: 리스아이(996a553)는 웹에서 hostname 이 localhost·127.0.0.1·0.0.0.0 인 비스트리밍 요청을 거절한다
# (globalApi.svelte.ts:709·845). 그래서 FAKE_URL 의 hostname 은 그 셋이 아니면서 브라우저가 닿는 곳이어야 한다. 차례대로 해 본다:
#   ① 컨테이너 IP (hostname -I 의 127 아닌 IPv4, 0단계 컨테이너에서는 192.0.2.2)
#   ② 127.0.0.2 (리눅스 루프백은 127.0.0.0/8 전부 받는다. 문자열이 127.0.0.1 이 아니라 검사에 안 걸림)
#   ③ 둘 다 안 되면 /etc/hosts 에 「127.0.0.1 t2-fake.test」를 한 줄 더하고 http://t2-fake.test 를 쓴다
#      (/etc 를 바꾸는 유일한 경우. 이름이 위 셋이 아니면서 루프백으로 가게 하려는 것. 루트가 아니면 못 하고 멈춘다)
#   각 후보는 curl 로 한 번, 리스아이 페이지 안 브라우저 fetch 로 한 번 닿는지 본다.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
GOEI=$(cd "$HERE/../../../.." && pwd)
RISU_REPO=https://github.com/kwaroran/RisuAI
RISU_SHA=996a5535fdb4629258331955982693a74ea209de
T2_HOME=${T2_HOME:-/tmp/t2}
RISU_DIR=${RISU_DIR:-$T2_HOME/risu-src}
VIA=${T2_VIA:-plain}
FAKE_LOG=${T2_FAKE_LOG:-$HERE/out/fake-llm.jsonl}
PIDS=$T2_HOME/pids
say() { printf '[t2-setup %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { say "✗ $*"; exit 1; }
mkdir -p "$T2_HOME"

stop_all() {
  [ -f "$PIDS" ] || { say "끌 것 없음 ($PIDS 없음)"; return 0; }
  while read -r name pid; do
    [ -n "${pid:-}" ] || continue
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
      # 조종 서버는 playwright 가 SIGTERM 에 브라우저만 닫고 HTTP 서버가 남아 안 끝난다 → 5초 뒤 KILL
      for _ in 1 2 3 4 5; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
      kill -0 "$pid" 2>/dev/null && { kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true; }
      say "끔: $name (pgid $pid)"
    fi
  done < "$PIDS"
  rm -f "$PIDS"
}
if [ "${1:-}" = stop ]; then stop_all; exit 0; fi
DO_CHECK=0; [ "${1:-}" = --check ] && DO_CHECK=1
[ -f "$PIDS" ] && die "$PIDS 가 있음 — 앞서 띄운 것이 있을 수 있다. 먼저 bash $0 stop (또는 T2_HOME 을 바꿔라)"

# ── 0. 도구 ──
for c in git node npm pnpm python3 curl; do command -v "$c" >/dev/null || die "$c 없음"; done
say "node $(node -v) · pnpm $(pnpm -v) · GOEI=$GOEI · RISU_DIR=$RISU_DIR"
# risu-t2.mjs 는 playwright 를 저장소 → 전역(npm root -g) 순서로 찾는다. 브라우저가 없으면 받는다.
PW_OK=$(cd "$HERE" && node --input-type=module -e "
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { existsSync } from 'node:fs';
let r; try { r = createRequire('$HERE/x.mjs'); r.resolve('playwright'); } catch { r = createRequire(execSync('npm root -g').toString().trim() + '/'); }
try { const p = r('playwright').chromium.executablePath(); console.log(existsSync(p) ? 'ok' : 'nobrowser'); } catch { console.log('nopw'); }" 2>/dev/null || echo nopw)
case "$PW_OK" in
  ok) say "playwright chromium 있음" ;;
  nobrowser) say "playwright 브라우저 없음 → npx playwright install chromium"; npx -y playwright install chromium ;;
  *) die "playwright 를 못 찾음 (전역 npm i -g playwright 후 npx playwright install chromium)" ;;
esac

port_free() { node -e "const s=require('net').createServer();s.once('error',()=>process.exit(1));s.listen($1,'$2',()=>s.close(()=>process.exit(0)))"; }
pick_port() { local p=$1 host=$2 n=0; until port_free "$p" "$host" && port_free "$p" 127.0.0.1; do p=$((p+1)); n=$((n+1)); [ $n -lt 50 ] || die "빈 포트 못 찾음 ($1~)"; done; echo "$p"; }
RISU_PORT=$(pick_port "${T2_RISU_PORT:-5180}" 127.0.0.1)
FAKE_PORT=$(pick_port "${T2_FAKE_PORT:-8790}" 0.0.0.0)
CTL_PORT=$(pick_port "${T2_CTL_PORT:-7101}" 127.0.0.1)
say "포트: 리스AI $RISU_PORT · 가짜 서버 $FAKE_PORT · 조종 $CTL_PORT"

# ── 1. 리스AI 원본 (고정 커밋) ──
if [ -d "$RISU_DIR/.git" ] && [ "$(git -C "$RISU_DIR" rev-parse HEAD 2>/dev/null)" = "$RISU_SHA" ]; then
  say "리스AI 이미 $RISU_SHA"
else
  [ -e "$RISU_DIR" ] && [ -n "$(ls -A "$RISU_DIR" 2>/dev/null)" ] && die "$RISU_DIR 가 비어 있지 않고 $RISU_SHA 도 아님 — 다른 RISU_DIR 를 줘라 (지우지 않음)"
  say "리스AI 받기 $RISU_REPO @ $RISU_SHA"
  mkdir -p "$RISU_DIR"
  git -C "$RISU_DIR" init -q
  git -C "$RISU_DIR" remote add origin "$RISU_REPO"
  git -C "$RISU_DIR" fetch -q --depth 1 origin "$RISU_SHA" || die "git fetch 실패 (프록시·GitHub 접근 확인)"
  git -C "$RISU_DIR" -c advice.detachedHead=false checkout -q FETCH_HEAD
fi
say "리스AI pnpm install"
( cd "$RISU_DIR" && pnpm install --frozen-lockfile ) > "$T2_HOME/pnpm-install.log" 2>&1 || { tail -30 "$T2_HOME/pnpm-install.log"; die "pnpm install 실패 ($T2_HOME/pnpm-install.log)"; }

# ── 2. 플러그인 release/ (판 그대로) ──
if [ "${T2_SKIP_BUILD:-0}" = 1 ] && [ -f "$GOEI/release/괴이_ANOMALY.charx" ]; then
  say "플러그인 빌드 건너뜀 (T2_SKIP_BUILD=1, release/ 있음)"
else
  PREP_ARGS=(--skip-tests); [ "${T2_PREP_TESTS:-0}" = 1 ] && PREP_ARGS=()
  say "플러그인 npm ci"
  ( cd "$GOEI" && npm ci ) > "$T2_HOME/npm-ci.log" 2>&1 || { tail -30 "$T2_HOME/npm-ci.log"; die "npm ci 실패 ($T2_HOME/npm-ci.log)"; }
  say "플러그인 npm run release:prep -- ${PREP_ARGS[*]:-} (판 그대로, 몇 분 걸림)"
  ( cd "$GOEI" && npm run release:prep -- "${PREP_ARGS[@]}" ) > "$T2_HOME/release-prep.log" 2>&1 || { tail -30 "$T2_HOME/release-prep.log"; die "release:prep 실패 ($T2_HOME/release-prep.log)"; }
fi
[ -f "$GOEI/release/괴이_ANOMALY.charx" ] || die "release/괴이_ANOMALY.charx 없음"
say "release/ 판 $(node -p "require('$GOEI/package.json').version")"

# ── 3. 백그라운드로 띄우기 ──
: > "$PIDS"
bg() { local name=$1 log=$2; shift 2; setsid nohup "$@" > "$log" 2>&1 < /dev/null & echo "$name $!" >> "$PIDS"; }
wait_http() { local url=$1 n=0; until curl --noproxy '*' -s -o /dev/null -m 3 "$url"; do n=$((n+1)); [ $n -lt "${2:-120}" ] || return 1; sleep 1; done; }

mkdir -p "$(dirname "$FAKE_LOG")"
bg fake "$T2_HOME/fake-llm.log" node "$HERE/fake-llm.mjs" --port "$FAKE_PORT" --log "$FAKE_LOG"
wait_http "http://127.0.0.1:$FAKE_PORT/_ctl/health" 30 || { cat "$T2_HOME/fake-llm.log"; die "가짜 서버가 안 뜸"; }

( cd "$RISU_DIR" && bg vite "$T2_HOME/vite-$RISU_PORT.log" env VITE_RISU_LEGAL_CONFIGURED=TRUE npx vite --port "$RISU_PORT" --strictPort --host 127.0.0.1 )
RISU_URL="http://127.0.0.1:$RISU_PORT"
wait_http "$RISU_URL/" 180 || { tail -30 "$T2_HOME/vite-$RISU_PORT.log"; die "리스AI vite 가 안 뜸"; }
say "리스AI vite dev 뜸 $RISU_URL"

# ── 4. 가짜 서버 주소 고르기 (위 머리 주석) ──
browser_ok() {  # 리스아이 페이지 안에서 브라우저 fetch 로 닿는지
  ( cd "$HERE" && node --input-type=module -e "
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
let r; try { r = createRequire('$HERE/x.mjs'); r.resolve('playwright'); } catch { r = createRequire(execSync('npm root -g').toString().trim() + '/'); }
const b = await r('playwright').chromium.launch(); const p = await b.newPage();
await p.goto('$RISU_URL/', { waitUntil: 'commit', timeout: 60000 });
const ok = await p.evaluate((u) => fetch(u).then((x) => x.status).catch((e) => String(e)), '$1/_ctl/health');
await b.close(); console.log(ok); process.exit(ok === 200 ? 0 : 1);" ) 2>&1 | tail -1
}
FAKE_URL=""
CANDS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^127\.' || true)
for h in $CANDS 127.0.0.2; do
  u="http://$h:$FAKE_PORT"
  if curl --noproxy '*' -s -m 3 "$u/_ctl/health" | grep -q '"ok":true'; then
    r=$(browser_ok "$u" || true)
    if [ "$r" = 200 ]; then FAKE_URL=$u; say "가짜 서버 주소 $u (curl·브라우저 둘 다 닿음)"; break; fi
    say "후보 $u: curl 은 닿고 브라우저는 안 닿음 ($r)"
  else say "후보 $u: curl 로 안 닿음"; fi
done
if [ -z "$FAKE_URL" ]; then
  [ "$(id -u)" = 0 ] || die "가짜 서버에 닿는 주소가 없고 /etc/hosts 를 바꿀 권한도 없음"
  grep -q 't2-fake\.test' /etc/hosts || { echo '127.0.0.1 t2-fake.test  # t2-setup.sh: 리스아이 localhost 검사를 피하는 루프백 이름' >> /etc/hosts; say "/etc/hosts 에 127.0.0.1 t2-fake.test 를 더함"; }
  u="http://t2-fake.test:$FAKE_PORT"
  r=$(browser_ok "$u" || true)
  [ "$r" = 200 ] || die "t2-fake.test 도 브라우저에서 안 닿음 ($r)"
  FAKE_URL=$u; say "가짜 서버 주소 $u"
fi
curl --noproxy '*' -s -m 3 -X POST "http://127.0.0.1:$FAKE_PORT/_ctl/reset" -d '{}' >/dev/null || true

# ── 5. 조종 서버 ──
GOEI_REL="$GOEI/release/"
( export RISU_URL FAKE_URL GOEI_REL; bg ctl "$T2_HOME/ctl-$CTL_PORT.log" node "$HERE/risu-t2.mjs" serve --port "$CTL_PORT" --via "$VIA" )
n=0; until grep -q 'ready' "$T2_HOME/ctl-$CTL_PORT.log" 2>/dev/null; do n=$((n+1)); [ $n -lt 60 ] || { cat "$T2_HOME/ctl-$CTL_PORT.log"; die "조종 서버가 안 뜸"; }; sleep 1; done

cat > "$T2_HOME/t2-env.sh" <<EOF
# t2-setup.sh 가 $(date '+%F %T') 에 적음. source 해서 쓴다.
export RISU_URL=$RISU_URL
export FAKE_URL=$FAKE_URL
export GOEI_REL=$GOEI_REL
export T2_CTL=http://127.0.0.1:$CTL_PORT
export T2_RISU_DIR=$RISU_DIR
EOF
say "다 뜸 ─────────────────────────────"
echo "  리스AI vite dev : $RISU_URL   (로그 $T2_HOME/vite-$RISU_PORT.log)"
echo "  가짜 모델 서버  : $FAKE_URL   (기록 $FAKE_LOG)"
echo "  조종 서버       : http://127.0.0.1:$CTL_PORT  --via $VIA  (아직 setup 안 함: curl -s -d '{\"op\":\"setup\"}' http://127.0.0.1:$CTL_PORT)"
echo "  환경 파일       : source $T2_HOME/t2-env.sh   ·  끄기: bash $0 stop"

if [ "$DO_CHECK" = 1 ]; then
  say "check (PC 1280x800, plain)"
  ( export RISU_URL FAKE_URL GOEI_REL; cd "$HERE" && node risu-t2.mjs check --via plain --w 1280 --h 800 ) > "$T2_HOME/check.log" 2>&1 || true
  grep -E '^(결과|캡처):' "$T2_HOME/check.log" || { tail -30 "$T2_HOME/check.log"; die "check 가 결과를 못 냄 ($T2_HOME/check.log)"; }
  line=$(grep -E '^결과:' "$T2_HOME/check.log" | tail -1)
  if [[ "$line" =~ 통과\ ([0-9]+)\ /\ ([0-9]+) ]] && [ "${BASH_REMATCH[1]}" = "${BASH_REMATCH[2]}" ]; then say "check 통과 ${BASH_REMATCH[1]}/${BASH_REMATCH[2]} (로그 $T2_HOME/check.log)"
  else die "check 실패: $line (로그 $T2_HOME/check.log)"; fi
fi
