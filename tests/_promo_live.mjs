// 홍보글 캡처용: 플러그인을 WQHD(또는 폰)로 띄워 단계 파일 하나를 돌린다.
// 사용: node tests/_promo_live.mjs <fixture> <단계.mjs> [--in 상태.json] [--out 상태.json] [--vp pc|phone]
// 단계 파일은 export default async ({ page, H, llm, shot, dump }) => {…}. 모델 응답은 llm([...]) 로 미리 넣고, 보낸 요청은 dump(이름) 으로 파일에 남긴다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as H from './qc-settings-harness.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const fx = H.loadFixture(args[0]);
const base = resolve('.scratch/promo');
const vpName = opt('--vp', 'pc');
const vp = vpName === 'phone' ? { width: 412, height: 915, touch: true, scale: 2 } : { width: 2560, height: 1440, touch: false };
const inFile = opt('--in');
const st = inFile && existsSync(inFile) ? JSON.parse(readFileSync(inFile, 'utf8')) : { chat: { message: [], scriptstate: {} }, store: {}, char: null };
if (st.char) fx.fixture = st.char;
const browser = await H.launch();
const { page, errors } = await H.boot(browser, fx, st.chat, vp, { store: st.store });
// 받기 흉내: release/ 폴더의 파일을 그대로 돌려준다
await page.exposeFunction('__readRelease', (u) => { const rel = String(u).split('?')[0].split('/release/').pop().split('/').slice(-1)[0]; const f = resolve('release', decodeURIComponent(rel)); return existsSync(f) ? readFileSync(f).toString('base64') : null; });
await page.evaluate(() => { window.risuai.nativeFetch = async (url) => { (window.__calls.fetch = window.__calls.fetch || []).push(url); const b = await window.__readRelease(String(url)); if (b == null) return { ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0)); const text = () => new TextDecoder().decode(bytes); return { ok: true, status: 200, json: async () => JSON.parse(text()), text: async () => text(), arrayBuffer: async () => bytes.slice().buffer }; }; });
// 모델 자리: 요청 글에 match 낱말이 든 첫 규칙의 응답을 한 번 돌려준다. 맞는 규칙이 없으면 실패로 답하고 요청은 dump 로 남는다
await page.evaluate(() => { window.__rules = []; window.risuai.runLLMModel = async (o) => { (window.__calls.llm = window.__calls.llm || []).push(o); await new Promise((r) => setTimeout(r, 150)); const text = JSON.stringify(o); const i = window.__rules.findIndex((r) => !r.used && (!r.match || text.includes(r.match))); if (i < 0) { o.__miss = true; return { type: 'fail', result: 'no mock' }; } window.__rules[i].used = true; o.__rule = i; return { type: 'success', result: window.__rules[i].result }; }; });
const llm = (list) => page.evaluate((l) => { window.__rules = l.map((r) => (typeof r === 'string' ? { result: r } : r)); }, list);
const shot = async (name, sel) => {
  mkdirSync(`${base}/out`, { recursive: true });
  const path = `${base}/out/${name}.png`;
  if (sel) await (typeof sel === 'string' ? page.locator(sel).first() : sel).screenshot({ path });
  else await page.screenshot({ path });
  return path;
};
const dump = async (name) => {
  const calls = await page.evaluate(() => { const c = window.__calls.llm || []; window.__calls.llm = []; return c; });
  mkdirSync(`${base}/req`, { recursive: true });
  calls.forEach((c, i) => writeFileSync(`${base}/req/${name}-${i}.json`, JSON.stringify(c, null, 1)));
  return calls.length;
};
const mod = await import(pathToFileURL(resolve(args[1])).href);
let result;
try { result = await mod.default({ page, H, llm, shot, dump, errors, vp }); } catch (e) { console.log('STEP FAIL', e?.stack ?? e); await shot('_fail').catch(() => {}); }
const outFile = opt('--out');
if (outFile) {
  const s = await page.evaluate(() => { const store = { ...window.__store }; delete store['p:goei:body']; delete store['p:goei:data-world']; return { chat: window.__chat, store, char: window.__char }; });
  writeFileSync(outFile, JSON.stringify(s));
}
if (result !== undefined) console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 1));
if (errors.length) console.log('page errors:', errors.slice(0, 5));
await browser.close();
