import fs from 'node:fs';
import assert from 'node:assert/strict';
import {launch,boot,startChat,setVars,output,bodyCode} from '../../../../tests/qc-host.mjs';
const needle='function previewAsset(lore, chat) {';
assert.ok(bodyCode.includes(needle));
const body=bodyCode.replace(needle,'window.auditPreviewAsset = async () => {const ctx=await loadContext();return previewAsset(ctx.char.globalLore,ctx.chat)}; '+needle);
const browser=await launch();
try {
  const fixture=JSON.parse(fs.readFileSync('.scratch/fixture/fixture.json','utf8'));
  const {page}=await boot(browser,fixture,{message:[],scriptstate:{}},{fixtureDir:'.scratch/fixture',body});
  await startChat(page,'A00',2);
  await setVars(page,{$pp_on:'0',$st_asset_model:'aux',$st_asset_on:'1',$st_anomaly_on:'0'});
  await page.evaluate(()=>{
    window.__chat.message.push({role:'user',data:'여기를 본다',chatId:'u1'},{role:'char',data:'쟈알디가 웃었다.\n\n사무실에 앉았다.',chatId:'c1'});
    window.__llm=[{type:'success',result:'[]'}];
  });
  const preview=await page.evaluate(()=>window.auditPreviewAsset());
  assert.ok(preview?.length);
  await output(page);
  const actual=await page.evaluate(()=>window.__calls.llm.at(-1)?.messages);
  fs.writeFileSync(process.env.AUDIT_LOG+'/14-preview-pair.json',JSON.stringify({preview,actual},null,2));
  assert.deepEqual(actual.map(({role,content})=>({role,content})),preview.map(({role,content})=>({role,content})));
  console.log('PASS 이미지 태그 보충 미리보기와 실제 모델 요청의 역할·본문 일치',preview.map(m=>[m.role,m.content.length]));
} finally { await browser.close(); }
