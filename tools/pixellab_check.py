"""PixelLab 동작 보내기 전 사용자 결정 대조 (사용자 2026-11-17 「쳐 만들어」).

Claude가 정하신 것을 잊고 다른 값(방향, 시작 그림, 장 수, 텍스트 시작 자세)으로 보내는 일이 되풀이되어 만든 장치다.
`tools/pixellab_decisions.json`(사용자 결정만, 출처 포함)과 보낼 값을 대조해서 다르면 NotAllowed 로 멈춘다.

쓰는 법 (동작 생성 스크립트):
    import pixellab_check as C
    C.check(subject="persona", kind="전투", row="전투 자세 잡기", body=body, start="south-east", first_row=True)
    # 통과하면 pixellab_gate.spend(...) 후 보낸다.

- subject: decisions.json 의 subjects 키 (persona, 공장 …)
- kind: 줄 묶음 이름 (전투, 반응, 샤워, 앉기, 화장실 …). excluded_kinds 면 막는다.
- row: 줄 이름. excluded_rows 에 든 낱말이 있으면 막는다.
- body: /animate-character 에 보낼 JSON
- start: 시작 그림이 어디서 왔는지. 등록 방향 그림이면 그 방향 이름(south-east 등), 고른 장이면 "pick:<줄 이름>:<장 번호>"
- first_row: 사슬의 첫 줄(전투 자세 잡기, 대기 등 고른 장이 없는 줄)이면 True. 시작 그림이 first_row_start 와 같아야 한다.
"""
import json
from pathlib import Path

DEC = Path(__file__).resolve().parent / "pixellab_decisions.json"
LOOP_MOVES = ("걷기", "달리기", "뛰기")


class NotAllowed(RuntimeError):
    pass


def _subj(name):
    d = json.loads(DEC.read_text(encoding="utf-8"))["subjects"]
    if name not in d:
        raise NotAllowed(f"결정 파일에 「{name}」이 없음 — 사용자에게 방향·시작 그림부터 묻는다")
    return d[name]


def check(subject, kind, row, body, start, first_row=False):
    s = _subj(subject)
    errs = []
    if body.get("character_id") not in s.get("character_ids", {}).values():
        errs.append(f"캐릭터 id {body.get('character_id')} 가 「{subject}」 등록 id 가 아님")
    if kind in s.get("excluded_kinds", []):
        errs.append(f"「{kind}」은 제외하기로 함")
    for w in s.get("excluded_rows", []):
        if w in row:
            errs.append(f"「{w}」 줄은 제외하기로 함")
    dirs = body.get("directions") or []
    allowed = set(s.get("motion_directions", [])) | set(s.get("base_state_directions", []))
    for d in dirs:
        if d not in allowed:
            errs.append(f"방향 {d} — 정한 방향은 기본 상태 {s.get('base_state_directions')}, 동작 {s.get('motion_directions')}")
    if first_row and start != s.get("first_row_start"):
        errs.append(f"첫 줄 시작 그림이 {start} — 정한 시작은 {s.get('first_row_start')}")
    if not first_row and not (str(start).startswith("pick:") or start in s.get("base_state_directions", [])):
        errs.append(f"시작 그림 {start} — 기본 상태 그림이나 사용자가 고른 장(pick:)에서 시작해야 함")
    for f in s.get("forbid_fields", []):
        if body.get(f):
            errs.append(f"{f} 를 글로 넣지 않기로 함")
    for name, mn in (s.get("min_frames") or {}).items():
        if name in row and (body.get("frame_count") or 0) < mn:
            errs.append(f"「{name}」 장 수 {body.get('frame_count')} — {mn}장 미만은 부족하다고 하심")
    if s.get("loop_moves_keep_first") and any(m in row for m in LOOP_MOVES) and body.get("keep_first_frame") is False:
        errs.append("걷기·달리기는 첫 장 유지를 켜기로 함(멈출 때 이어짐)")
    if errs:
        raise NotAllowed(f"[{subject} · {row}] 보내지 않음:\n  - " + "\n  - ".join(errs))
    return True
