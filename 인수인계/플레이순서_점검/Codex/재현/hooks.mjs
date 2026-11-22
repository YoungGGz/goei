import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
const watch = new URL('./observe.mjs', import.meta.url).href;
registerHooks({load(url, ctx, next) {
  const loaded = next(url,ctx);
  if (loaded.format !== 'module' || !url.startsWith(pathToFileURL(process.cwd()+'/tests/').href)) return loaded;
  let source = String(loaded.source);
  if (!source.includes('await page.setContent(')) return loaded;
  source = source.replaceAll('await page.setContent(', 'await import('+JSON.stringify(watch)+').then(m=>m.observe(page)); await page.setContent(');
  return { ...loaded, source };
}});
