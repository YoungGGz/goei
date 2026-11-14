import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HOMESHOP_PACK_NAME, INSTALL_PACK_NAME, ITEMS_PACK_NAME, LOOKS_PACK_NAME, WORLD_PACK_NAME, homeshopPackText, installPackText, itemsPackText, looksPackText, packOf, worldPackText } from './data-pack.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
if (process.env.GOEI_BUILD_VERSION) pkg.version = process.env.GOEI_BUILD_VERSION;
// 업데이트 주소: package.json의 goei.updateBase (저장소 release 폴더 raw 주소). 있으면 Risu 플러그인 탭이 이 주소로 플러그인을 갱신한다
const updateBase = String(process.env.GOEI_UPDATE_BASE ?? pkg.goei?.updateBase ?? '').replace(/\/+$/, '');
const header = [
  '//@name goei-plugin',
  `//@display-name 괴이: ANOMALY v${pkg.version}`,
  '//@api 3.0',
  `//@version ${pkg.version}`,
  ...(updateBase ? [`//@update-url ${updateBase}/goei-plugin.js`] : []),
  '//@description 괴이: ANOMALY 전용 플러그인 (괴이봇 2탄 기반): 시작 화면, 상황판, 지도·요원 이동, 커스텀 임무, 괴담넷, 괴담톡, 위키, 설정·캐릭터 이미지',
  '',
].join('\n');

mkdirSync('dist', { recursive: true });

// 자료 팩 (QC 개선 나1, scripts/data-pack.mjs): 세계 자료·설치 자료는 본체에 번들하지 않고 goei-data-<이름>.json + .N.txt 로 따로 받는다.
// 지문(hash·sha256·length)을 본체에 박아(define) 본체가 자기와 맞는 자료만 쓴다. 조각은 본체와 같은 200KB 이하
const dataPacks = [packOf(WORLD_PACK_NAME, worldPackText(), pkg.version), packOf(INSTALL_PACK_NAME, installPackText(), pkg.version), packOf(ITEMS_PACK_NAME, itemsPackText(), pkg.version), packOf(LOOKS_PACK_NAME, looksPackText(), pkg.version), packOf(HOMESHOP_PACK_NAME, homeshopPackText(), pkg.version)];
for (const f of readdirSync('dist')) if (/^goei-data-[a-z]+\.(\d+\.)?(txt|json)$/.test(f)) unlinkSync(`dist/${f}`);
for (const p of dataPacks) {
  p.parts.forEach((part, i) => writeFileSync(`dist/${p.partNames[i]}`, part));
  writeFileSync(`dist/${p.name}.json`, JSON.stringify(p.index) + '\n');
}
const [worldPack, installPack, itemsPack, looksPack, homeshopPack] = dataPacks;
// 세계 자료를 한 파일로도 (goei-data-world.txt): 릴리스 zip 에 넣어, 네트워크가 막힌 환경에서 본체(goei-body.js)와 함께 받기 창에 파일로 넣는다 (host/datapanel.ts)
writeFileSync(`dist/${worldPack.name}.txt`, worldPack.text);

const define = {
  __UPDATE_BASE__: JSON.stringify(updateBase),
  __PLUGIN_VERSION__: JSON.stringify(pkg.version),
  __WORLD_PACK__: JSON.stringify(JSON.stringify(worldPack.expect)),
  __INSTALL_PACK__: JSON.stringify(JSON.stringify(installPack.expect)),
  __ITEMS_PACK__: JSON.stringify(JSON.stringify(itemsPack.expect)),
  __LOOKS_PACK__: JSON.stringify(JSON.stringify(looksPack.expect)),
  __HOMESHOP_PACK__: JSON.stringify(JSON.stringify(homeshopPack.expect)),
};
const common = {
  define,
  bundle: true,
  target: 'es2022',
  charset: 'utf8',
  minify: false,
  legalComments: 'none',
  loader: { '.css': 'text', '.txt': 'text' },
  write: false,
};

// 플러그인 파일 = 시작기만 (모든 봇에서 읽히므로 작게). 본체는 괴이 카드를 열 때 시작기가 꺼낸다 (src/main.ts)
const loader = await build({ ...common, entryPoints: ['src/main.ts'], format: 'esm' });
const code = header + loader.outputFiles[0].text;
writeFileSync('dist/goei-plugin.js', code);

// 본체: 첫 줄의 판으로 시작기와 맞는지 본다. 받을 때는 조각(goei-body.N.txt)으로 받는다 (Risu 웹 프록시는 1MB 넘는 파일을 못 받는다)
// 배포 본체에서는 시험용 예외 주입 블록(src/body.ts faultOn 의 GOEI_TEST: 이름표)을 통째로 뺀다
const bodyOut = await build({ ...common, entryPoints: ['src/body-entry.ts'], format: 'iife', dropLabels: ['GOEI_TEST'] });
const bodyCode = `// goei-body ${pkg.version}\n` + bodyOut.outputFiles[0].text;
writeFileSync('dist/goei-body.js', bodyCode);
// 시험 본체: 같은 본체에 예외 주입 블록만 남긴 것. 요청 조립 실패 시험(tests/qc-pipeline-browser.mjs 8절·qc-static-risu-browser.mjs)만 이것을 쓴다
mkdirSync('dist-test', { recursive: true });
{
  const t = await build({ ...common, entryPoints: ['src/body-entry.ts'], format: 'iife' });
  writeFileSync('dist-test/goei-body.js', `// goei-body ${pkg.version}\n` + t.outputFiles[0].text);
}
for (const f of readdirSync('dist')) if (/^goei-body\.\d+\.txt$/.test(f)) unlinkSync(`dist/${f}`);
const bodyParts = [];
{
  const PART_BYTES = 200_000;
  let buf = '';
  let bytes = 0;
  for (const ch of bodyCode) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > PART_BYTES) (bodyParts.push(buf), (buf = ''), (bytes = 0));
    buf += ch;
    bytes += n;
  }
  if (buf) bodyParts.push(buf);
}
const partNames = bodyParts.map((p, i) => {
  const name = `goei-body.${i + 1}.txt`;
  writeFileSync(`dist/${name}`, p);
  return name;
});
/** 글 지문 (src/loader/body.ts bodyHash 와 같게): UTF-16 단위의 FNV-1a 32비트. 시작기가 조각을 이어 붙인 뒤 글자까지 맞는지 본다 */
function textHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
// 목록: length(JS 글자 수) · hash(FNV-1a, crypto.subtle 이 없는 환경용) · sha256(이어 붙인 본체 전체의 UTF-8 바이트, 보안 컨텍스트에서 시작기가 본다. QC 개선 나2).
// 조각마다 sha256 은 넣지 않는다: 시작기는 전체를 다시 받을 뿐 조각 단위 재시도가 없고, 받는 쪽 코드가 커진다 (docs/qc/09_개선_나_2_3.md)
writeFileSync(
  'dist/goei-body.json',
  JSON.stringify({ version: pkg.version, parts: partNames, length: bodyCode.length, hash: textHash(bodyCode), sha256: createHash('sha256').update(bodyCode).digest('hex') }) + '\n',
);

// 테스트용: 순수 로직만 묶은 모듈. 세계·설치 자료는 본체처럼 묶음에 없으므로 입구(core.mjs)가 tests/data-init.mjs 로 파일에서 읽어 넣은 뒤 내보낸다
await build({
  define,
  entryPoints: ['src/core/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  charset: 'utf8',
  loader: { '.txt': 'text' },
  outfile: 'dist-test/core.bundle.mjs',
});
writeFileSync(
  'dist-test/core.mjs',
  [
    '// 시험용 입구 (scripts/build.mjs 가 만든다): 본체가 자료 팩으로 받는 세계·설치 자료를 파일에서 넣고(tests/data-init.mjs) core 를 그대로 내보낸다',
    "import * as core from './core.bundle.mjs';",
    "import { initTestData } from '../tests/data-init.mjs';",
    'initTestData(core);',
    "export * from './core.bundle.mjs';",
    '',
  ].join('\n'),
);

// 시험용: 원본 카드의 module.json (tests/realcard.mjs 가 찾는다. 「실제 카드」 시험 15개가 이걸 읽는다). python3 가 없으면 그 시험들은 건너뛴다
if (existsSync('카드/원본_봇카드.jpeg')) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('python3', ['-I', 'tests/extract_module.py'], { encoding: 'utf8' });
  if (r.status !== 0) console.log(`실제 카드 module.json 을 풀지 못했어요 (실제 카드 시험은 건너뜀): ${(r.stderr || r.error?.message || '').trim().split('\n').pop()}`);
}


// 토크나이저 순위표 (o200k_base, js-tiktoken MIT): 플러그인이 설치·점검에서 받아 저장소에 둔다 (core/tokenizer.ts). 200KB 조각 + 목록
{
  const ranks = (await import('js-tiktoken/ranks/o200k_base')).default;
  const text = JSON.stringify({ pat_str: ranks.pat_str, special_tokens: ranks.special_tokens, bpe_ranks: ranks.bpe_ranks });
  for (const f of readdirSync('dist')) if (/^tok-o200k\.\d+\.txt$/.test(f)) unlinkSync(`dist/${f}`);
  const PART = 200_000;
  const parts = [];
  let buf = '';
  let bytes = 0;
  for (const ch of text) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > PART) (parts.push(buf), (buf = ''), (bytes = 0));
    buf += ch;
    bytes += n;
  }
  if (buf) parts.push(buf);
  const names = parts.map((p, i) => {
    const name = `tok-o200k.${i + 1}.txt`;
    writeFileSync(`dist/${name}`, p);
    return name;
  });
  writeFileSync('dist/tok-o200k.json', JSON.stringify({ name: 'o200k_base', parts: names, length: text.length, digest: createHash('sha1').update(text).digest('hex').slice(0, 12) }));
  console.log({ tokenizer: 'o200k_base', parts: names.length, chars: text.length });
}
const info = {
  version: pkg.version,
  bytes: Buffer.byteLength(code),
  bodyBytes: Buffer.byteLength(bodyCode),
  bodyParts: partNames.length,
  dataPacks: dataPacks.map((p) => `${p.name} ${Buffer.byteLength(p.text)} (${p.parts.length}조각, hash ${p.expect.hash})`),
  sha256: createHash('sha256').update(code).digest('hex'),
};
writeFileSync('dist/build-info.json', JSON.stringify(info, null, 2) + '\n');
console.log(info);
