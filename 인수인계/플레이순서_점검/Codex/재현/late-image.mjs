import fs from 'node:fs';
import assert from 'node:assert/strict';
import {launch,boot,startChat,setVars,output,chat} from '../../../../tests/qc-host.mjs';
const b=await launch();
try{
 const fx=JSON.parse(fs.readFileSync('.scratch/fixture/fixture.json'));
 const {page}=await boot(b,fx,{message:[],scriptstate:{}},{fixtureDir:'.scratch/fixture'});
 await startChat(page,'A00',2);
 await setVars(page,{$pp_on:'0',$st_asset_model:'aux',$st_asset_on:'1',$st_anomaly_on:'0'});
 const add=(key,text)=>page.evaluate(([key,text])=>window.__chat.message.push({role:'user',data:'계속',chatId:'u'+key},{role:'char',data:text,chatId:key}),[key,text]);
 await add('c1','쟈알디가 웃었다.\n\n첫 장면이다.');
 await page.evaluate(()=>{window.auditCalls=0;window.risuai.runLLMModel=async()=>{window.auditCalls++;if(window.auditCalls===1) await new Promise(r=>window.releaseImage=r);return {type:'success',result:'[{"line":1,"tag":"<img=Jyaldi_smile>"}]'};};});
 const old=output(page);
 await page.waitForFunction(()=>typeof window.releaseImage==='function');
 await add('c2','쟈알디가 웃었다.\n\n두 번째 장면이다.');
 const newest=output(page);
 await newest;
 await page.evaluate(()=>window.releaseImage());
 await old;
 let c=await chat(page);
 console.log('overlapping outputs',await page.evaluate(()=>window.auditCalls),c.message.filter(m=>['c1','c2'].includes(m.chatId)).map(m=>m.data));
 await add('c3','쟈알디가 웃었다.\n\n세 번째 장면이다.');
 await output(page);c=await chat(page);
 assert.ok(c.message.at(-1).data.includes('<img=Jyaldi_smile>'));
 console.log('serial control',await page.evaluate(()=>window.auditCalls),c.message.at(-1).data);
 assert.ok(c.message.find(m=>m.chatId==='c2').data.includes('<img=Jyaldi_smile>'),'최신 응답의 보충 누락');
}finally{await b.close();}
