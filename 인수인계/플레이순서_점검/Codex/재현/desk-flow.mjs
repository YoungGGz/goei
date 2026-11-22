import {boot, launch, openWin, closeEditor, openEditor, loadFixture} from '../../../../tests/qc-settings-harness.mjs';
import assert from 'node:assert/strict';
const fx=loadFixture('.scratch/fixture/fixture.json'), b=await launch();
const shop='<shop-identity>\nsells: 문구류\nnever: 식품\nprices: 정가\n</shop-identity>\n<owner>새 상품입니다.</owner>\n<shelf>\n등대수첩|300|사용|서류/수첩/notebook|0.1|작은 수첩|내용을 적는다||시험용숨은효과\n유리책갈피|200|사용|서류/책갈피/bookmark|0.01|얇은 유리|쪽을 표시한다||?\n</shelf>';
const catalog=shop.replace('등대수첩|300','돋보기|300');
const key='$st_wallet', pk='$st_points';
for(const enabled of [true,false]){
const site='bm'; const message=[{role:'user',data:'인터넷을 연다.',chatId:'u1'},{role:'char',data:'장면.\n[▣|2025.03.14|02:30 PM|☀️|8°C|백일몽 본사|없음|없음|없음|백일몽/사원|73519|1500]',chatId:'c1'}];
const vars={$st_faction:'C00',$ib_affiliation:'백일몽',$st_lang:'ko',$st_fm:'2',$st_anomaly_on:'1',$pp_on:'0',$br_login:'1',$br_nick:'시험사원',$st_points_on:'1',$cos_fixed:'[]',$st_items:'{"list":[],"log":[]}',[key]:JSON.stringify({start:73519,log:[]}),[pk]:JSON.stringify({start:1500,log:[]})};
vars.$bm_desk_on=enabled?'1':'0';const {page}=await boot(b,fx,{message,scriptstate:vars},{width:1400,height:900,touch:false});
page.setDefaultTimeout(6000);
const loc=(a,v)=>page.locator('button[data-action="'+a+'"]'+(v!==undefined?'[data-value="'+v+'"]':'')+':visible').first();
const click=(a,v)=>loc(a,v).click();
const q=async r=>page.evaluate(s=>{window.__llm=[{type:'success',result:s}]},r);
const ss=()=>page.evaluate(()=>window.__chat.scriptstate);
const calltext=()=>page.evaluate(()=>window.__calls.llm.at(-1).messages.map(m=>String(m.content)).join('\n'));
const wait=async (s)=>page.getByText(s,{exact:true}).first().waitFor();
try{
await openWin(page); await openEditor(page,'manage:flow');
const obj=await page.evaluate(()=>[...document.querySelectorAll('.fl-name')].filter(e=>e.textContent==='포인트몰 1:1 상담').map(e=>{const row=e.closest('.fl-line,.flc'); const cost=row.querySelector('.fl-said,.flc-calls');return {v:cost.getClientRects().length&&getComputedStyle(cost).visibility!=='hidden',cost:cost.textContent};}));console.log('화면 호출 값',obj);assert.ok(obj.some(o=>o.v));const text=obj.find(o=>o.v).cost;await closeEditor(page,true);
await page.click('.gx-nav .gx-nb:not(.mob)[data-value="net"]');await page.click('.br-bm[data-value="bm"]');
const hasButton=await loc('mall-ask').count();assert.equal(hasButton,enabled?1:0);console.log('상담 사용',enabled,'몰 상담 버튼',hasButton,'관제 호출 문구',text.replaceAll('\n',' '));
if(!enabled)assert.ok(!text.includes('1회'),'실제 상담 단추가 사라져도 관제 화면은 호출을 표시');
}catch(e){console.error(site,'FAIL',e.message);process.exitCode=1;}finally{await page.close();}
}await b.close();
