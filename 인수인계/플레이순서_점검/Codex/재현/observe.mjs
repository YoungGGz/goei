import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
let seq = 0;
const globalModules = execFileSync('npm', ['root', '-g'], {encoding:'utf8'}).trim();
const fonts = [process.env.AUDIT_FONTS, path.join(process.cwd(),'node_modules/@fontsource'),
  path.join(globalModules,'@fontsource'), path.resolve(globalModules,'../../node_modules/@fontsource')]
  .find(dir => dir && fs.existsSync(path.join(dir,'ibm-plex-sans-kr/400.css')));
if (!fonts) throw Error('AUDIT_FONTS에 @fontsource 두 글꼴을 설치한 디렉터리를 지정하세요.');
const css = ['ibm-plex-sans-kr','jetbrains-mono'].flatMap(f => [400,500,600,700].map(w => fs.readFileSync(path.join(fonts,f,w+'.css'),'utf8').replaceAll('url(./files/', 'url(https://fonts.gstatic.com/goei-local/'+f+'/files/'))).join('\n');
function tap() {
  const host = window.risuai;
  if (!host) return;
  const record = (type, payload) => window.__auditSave(type, JSON.stringify(payload)).catch(()=>{});
  const wrapModel = fn => async function(...args) {
    await record('request', args[0]);
    const reply = await fn.apply(host,args);
    await record('reply', reply);
    return reply;
  };
  let model = wrapModel(host.runLLMModel);
  Object.defineProperty(host,'runLLMModel',{configurable:true,get:()=>model,set:fn=>{model=wrapModel(fn);}});
  const register = host.addRisuReplacer?.bind(host);
  if (register) host.addRisuReplacer = (kind,fn) => register(kind, async (...args) => {
    const output = await fn(...args);
    if (kind==='beforeRequest') await record('main',output);
    return output;
  });
  const put = host.setChatToIndex?.bind(host);
  if (put) host.setChatToIndex = async (ci, idx, chat) => {
    const out = await put(ci,idx,chat);
    await record('state',{ci,idx,vars:chat?.scriptstate,people:chat?.goeiPeopleV1,localLore:chat?.localLore,message:chat?.message});
    return out;
  };
}
export async function observe(page) {
  const id = ++seq;
  const root = process.env.AUDIT_LOG;
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:css}));
  await page.route('https://fonts.gstatic.com/goei-local/**',route=>{
    const rel = new URL(route.request().url()).pathname.slice('/goei-local/'.length);
    return route.fulfill({contentType:'font/woff2',path:path.join(fonts,rel),headers:{'access-control-allow-origin':'*'}});
  });
  await page.exposeFunction('__auditSave', (type,raw)=>{
    if (raw !== undefined) fs.appendFileSync(root+'/'+process.env.AUDIT_NAME+'.jsonl',JSON.stringify({page:id,type,payload:JSON.parse(raw)})+'\n');
  });
  page.on('pageerror',e=>fs.appendFileSync(root+'/'+process.env.AUDIT_NAME+'.errors',String(e)+'\n'));
  const add=page.addScriptTag.bind(page);
  page.addScriptTag=async(options)=>{
    const script=await add(options);
    if(options.content?.includes('window.risuai = {')) await page.evaluate(tap);
    return script;
  };
}
