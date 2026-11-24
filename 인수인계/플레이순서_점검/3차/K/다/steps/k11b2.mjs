// k11b 의 마지막 갈래만 다시 (늦은 위키 호출) — k11b.mjs 를 고친 뒤 같은 브라우저에서
import { rec, sleep } from '../lib.mjs';
export default async function (C) {
  const m = await import('./k11b.mjs?v=' + Date.now());
  return m.lateOnly ? m.lateOnly(C) : 'no';
}
