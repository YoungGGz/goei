import {boot, launch, openWin, closeEditor, loadFixture} from '../../../../tests/qc-settings-harness.mjs';
import assert from 'node:assert/strict';
const fx=loadFixture('.scratch/fixture/fixture.json'), b=await launch();
const shop='<shop-identity>\nsells: 문구류\nnever: 식품\nprices: 정가\n</shop-identity>\n<owner>새 상품입니다.</owner>\n<shelf>\n등대수첩|300|사용|서류/수첩/notebook|0.1|작은 수첩|내용을 적는다||시험용숨은효과\n유리책갈피|200|사용|서류/책갈피/bookmark|0.01|얇은 유리|쪽을 표시한다||?\n</shelf>';
const catalog=shop.replace('등대수첩|300','돋보기|300');
const key='$st_wallet', pk='$st_points';
for(const site of ['cos','bm']){
const message=[{role:'user',data:'인터넷을 연다.',chatId:'u1'},{role:'char',data:'장면.\n[▣|2025.03.14|02:30 PM|☀️|8°C|백일몽 본사|없음|없음|없음|백일몽/사원|73519|1500]',chatId:'c1'}];
const vars={$st_faction:'C00',$ib_affiliation:'백일몽',$st_lang:'ko',$st_fm:'2',$st_anomaly_on:'1',$pp_on:'0',$br_login:'1',$br_nick:'시험사원',$st_points_on:'1',$cos_fixed:'[]',$st_items:'{"list":[],"log":[]}',[key]:JSON.stringify({start:73519,log:[]}),[pk]:JSON.stringify({start:1500,log:[]})};
const {page}=await boot(b,fx,{message,scriptstate:vars},{width:1400,height:900,touch:false});
page.setDefaultTimeout(6000);
const loc=(a,v)=>page.locator('button[data-action="'+a+'"]'+(v!==undefined?'[data-value="'+v+'"]':'')+':visible').first();
const click=(a,v)=>loc(a,v).click();
const q=async r=>page.evaluate(s=>{window.__llm=[{type:'success',result:s}]},r);
const ss=()=>page.evaluate(()=>window.__chat.scriptstate);
const calltext=()=>page.evaluate(()=>window.__calls.llm.at(-1).messages.map(m=>String(m.content)).join('\n'));
const wait=async (s)=>page.getByText(s,{exact:true}).first().waitFor();
try{
await openWin(page); if(await page.locator('.gw:visible').count())await closeEditor(page,true);
await page.click('.gx-nav .gx-nb:not(.mob)[data-value="net"]');
await page.click('.br-bm[data-value="'+site+'"]');
await q(shop); await click('mall-refresh'); await wait('등대수첩');
assert.ok(!(await page.locator('.ms').innerText()).includes('시험용숨은효과'));
const sentBalance=(await calltext()).includes('|73519');
console.log(site,'first; raw status money in prompt:',sentBalance);
await q(catalog); await click('br-reload'); await wait('돋보기');
const included=(await calltext()).includes('유리책갈피');
console.log(site,'unsold previous item in whole request:',included,'relisted:',await page.getByText('유리책갈피',{exact:true}).count());
if(sentBalance||!included) process.exitCode=1;
if(site==='cos'){
await click('mall-cart'); await click('mall-page','cart'); await click('mall-order'); await click('mall-pay');
await page.waitForFunction(()=>JSON.parse(window.__chat.scriptstate.$st_items).list.length===1);
const bought=JSON.parse((await ss()).$st_items).list[0];
assert.equal(bought.truth,'시험용숨은효과');
assert.equal(JSON.parse((await ss())[key]).log.at(-1).amount,-300);
await click('mall-ask',''); await q('<owner>확인했습니다.</owner>\n<change mode="none"></change>\n<info>수첩 정보|50|정보 본문입니다.</info>\n<order>무지수첩|100|2|사용|서류/수첩/notebook|0.1|맞춤 수첩|기록|?</order>');
const input=page.locator('input[name="mall-say"]:visible'); await input.fill('정보와 맞춤 주문 견적을 주세요.');await input.press('Enter');
await click('mall-note-buy'); await click('mall-quote-accept');
const st=await ss(); assert.equal(JSON.parse(st.$cos_orders).length,1);
assert.ok(JSON.parse(st.$st_items).list.some(i=>i.text==='정보 본문입니다.'));
console.log(site,'paid rows',JSON.parse(st[key]).log.map(r=>r.amount));
}else{
await click('mall-buy'); await click('mall-page','orders');
assert.equal(JSON.parse((await ss()).$bm_orders).length,1);
assert.equal(JSON.parse((await ss()).$st_items).list.length,0);
await click('mall-pickup-all'); await page.waitForFunction(()=>JSON.parse(window.__chat.scriptstate.$st_items).list.length===1);
assert.equal(JSON.parse((await ss())[pk]).log.at(-1).amount,-300);
await q('<card>\n이름: 시험상담원\n직급: 사원\n부서: 상담\n</card>\n<say>안녕하세요.</say>');
await click('mall-ask'); await wait('안녕하세요.');
await q('<say>확인했습니다.</say>\n<end/>');
const input=page.locator('input[name="mall-say"]:visible');await input.fill('수령 장소가 어디입니까?');await input.press('Enter');
await page.waitForFunction(()=>JSON.parse(window.__chat.scriptstate.$bm_desk).ended);
assert.ok(!(await page.locator('.bd').allTextContents()).join('').includes('시험상담원'));
console.log(site,'direct pick-up and counselor end');
}
const out=await page.evaluate(async()=>{window.__chat.message.push({role:'user',data:'계속',chatId:'u2'});return window.__calls.replacers[0](window.__chat.message.map(m=>({role:m.role==='char'?'assistant':'user',content:m.data})), 'model');});
console.log(site,'main purchase context',out.some(m=>String(m.content).includes('돋보기')),'hidden effect copied',out.some(m=>String(m.content).includes('시험용숨은효과')));
}catch(e){console.error(site,'FAIL',e.message);process.exitCode=1;}finally{await page.close();}
}await b.close();
