import {boot, launch, openWin, closeEditor, loadFixture} from '../../../../tests/qc-settings-harness.mjs';
import assert from 'node:assert/strict';
const fx=loadFixture('.scratch/fixture/fixture.json'), b=await launch();
const shop='<shop-identity>\nsells: 문구류\nnever: 식품\nprices: 정가\n</shop-identity>\n<owner>새 상품입니다.</owner>\n<shelf>\n등대수첩|300|사용|서류/수첩/notebook|0.1|작은 수첩|내용을 적는다||시험용숨은효과\n유리책갈피|200|사용|서류/책갈피/bookmark|0.01|얇은 유리|쪽을 표시한다||?\n</shelf>';
const catalog=shop.replace('등대수첩|300','돋보기|300');
const key='$st_wallet', pk='$st_points';
for(const site of ['bm']){
const message=[{role:'user',data:'인터넷을 연다.',chatId:'u1'},{role:'char',data:'장면.\n[▣|2025.03.14|02:30 PM|☀️|8°C|백일몽 본사|없음|없음|없음|백일몽/사원|73519|1500]',chatId:'c1'}];
const vars={$st_faction:'C00',$ib_affiliation:'백일몽',$st_lang:'ko',$st_fm:'2',$st_anomaly_on:'1',$pp_on:'0',$br_login:'1',$br_nick:'시험사원',$st_points_on:'1',$cos_fixed:'[]',$st_items:'{"list":[],"log":[]}',[key]:JSON.stringify({start:73519,log:[]}),[pk]:JSON.stringify({start:0,log:[]})};
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
await q(shop.replace('등대수첩|300','등대수첩|연필 한 자루')); await click('mall-refresh'); await wait('등대수첩');
const rows=page.locator('.bp-it'); console.log('화면',await rows.first().innerText());
const before=await ss();const offers=JSON.parse(before.$bm_shop).items;
console.log('잔고',before[pk],'양식 오류 상품',offers[0],'정상 상품 구매 비활성',await rows.nth(1).locator('button').isDisabled());
if (await rows.first().locator('button').isDisabled()) { console.log('PASS 잘못된 가격을 차단함'); continue; }
await rows.first().locator('button').click();await click('mall-page','orders');
await click('mall-pickup-all');
await page.waitForFunction(()=>JSON.parse(window.__chat.scriptstate.$st_items).list.length===1);
const after=await ss();console.log('수령 후',after[pk],JSON.parse(after.$st_items).list.map(i=>[i.name,i.paidWith]),'주문',JSON.parse(after.$bm_orders).map(o=>[o.price,o.taken]));
assert.fail('현물 대가가 지정된 비정상 상품이 0포인트에 수령됨');
}catch(e){console.error(site,'FAIL',e.message);process.exitCode=1;}finally{await page.close();}
}await b.close();
