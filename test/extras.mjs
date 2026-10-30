// Behaviour checks beyond layout: skip guard, hidden tab, reload mid-shot, reduced motion, fast play persistence.
import { chromium } from 'playwright';
const URL='http://127.0.0.1:8765/index.html';const b=await chromium.launch({channel:'chrome'});const fails=[];const ok=(c,m)=>{console.log(`${c?'PASS':'FAIL'}  ${m}`);if(!c)fails.push(m)};
async function fresh(opts={},lane=0){const ctx=await b.newContext({viewport:{width:390,height:844},...opts});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(URL);await p.evaluate(()=>localStorage.clear());await p.reload();await p.click('#b-new');await p.click('#b-start');await p.click('#b-next');await p.click(`.tier[data-lane="${lane}"]`);return{ctx,p,errs}}
const G=p=>p.evaluate(()=>JSON.parse(JSON.stringify(CUH.G)));
const idle=p=>p.waitForFunction(()=>!CUH.anim.busy,null,{polling:50,timeout:15000});
// 1. tap to skip: state already right, and the same tap does not also roll for the next player
{const {ctx,p,errs}=await fresh();await p.evaluate(()=>{CUH.rig(4,4);document.getElementById('b-roll').click()});
 await p.waitForFunction(()=>CUH.anim.phase==='flight',null,{polling:'raf'});
 const box=await p.locator('#b-roll').boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2); // tap lands on the roll button
 await idle(p);await p.waitForTimeout(600);const g=await G(p);
 ok(g.lie[0].pos===8&&g.lie[0].strokes===1,'skip mid-flight: Kyle on peg 8 with 1 stroke');
 ok(g.lie[1].strokes===0&&g.order[g.turn]===1,'the skipping tap did not also play Brooke\'s shot');
 const t=await p.evaluate(()=>document.getElementById('w-name').textContent);ok(t==='Brooke','panel shows the next player after skip');
 ok(!errs.length,'no console errors (skip) '+errs.join(';'));await ctx.close()}
// 2. tab hidden mid-shot: animation finishes instantly, board matches state when it comes back
{const {ctx,p,errs}=await fresh();await p.evaluate(()=>{CUH.rig(2,3);document.getElementById('b-roll').click()});await p.waitForFunction(()=>CUH.anim.phase==='launch',null,{polling:'raf'});
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))});
 await idle(p);const busy=await p.evaluate(()=>CUH.anim.busy);ok(!busy,'hidden tab: animation released immediately');
 const drawn=await p.evaluate(()=>{const g=document.querySelector('#balls [data-i="0"]');return g&&g.style.transform});const g=await G(p);
 const exp=await p.evaluate(()=>{const h=HOLES[0],pt=h.routes[CUH.G.lie[0].lane].pts[CUH.G.lie[0].pos];return `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`});
 ok(g.lie[0].pos===5&&drawn.replace(/\s/g,'')===exp.replace(/\s/g,''),`hidden tab: ball drawn on its real peg (${drawn})`);ok(!errs.length,'no console errors (hidden) '+errs.join(';'));await ctx.close()}
// 3. reload mid-animation: saved state already includes the shot
{const {ctx,p}=await fresh();await p.evaluate(()=>{CUH.rig(6,6);document.getElementById('b-roll').click()});await p.waitForFunction(()=>CUH.anim.phase==='flight',null,{polling:'raf'});
 await p.reload();await p.click('#b-continue');const g=await G(p);ok(g.scores[0][0]===1&&g.lie[0].state==='holed','reload mid-ace: the hole in one is already saved');await ctx.close()}
// 4. reduced motion: no confetti, no shake, info still shown, quick
{const {ctx,p,errs}=await fresh({reducedMotion:'reduce'},2);
 const t0=Date.now();await p.evaluate(()=>{CUH.rig(2,2);document.getElementById('b-roll').click()}); // water
 await p.waitForFunction(()=>CUH.anim.phase==='water',null,{polling:'raf'});const toast=await p.evaluate(()=>document.querySelector('.toast')&&document.querySelector('.toast').textContent);
 const shake=await p.evaluate(()=>document.getElementById('svg').style.transform);await idle(p);const ms=Date.now()-t0;
 ok(/Splash/.test(toast||''),`reduced motion: water toast shown ("${toast}")`);ok(!shake,'reduced motion: no screen shake');ok(ms<2500,`reduced motion: water shot done in ${ms}ms`);
 await p.click('.tier[data-lane="0"]');await p.evaluate(()=>{CUH.rig(6,6);document.getElementById('b-roll').click()});await p.waitForFunction(()=>CUH.anim.phase==='ace',null,{polling:'raf'});await p.waitForTimeout(400);
 const r=await p.evaluate(()=>({conf:document.querySelectorAll('.cf').length,banner:document.querySelector('.banner')&&document.querySelector('.banner').textContent}));
 ok(r.conf===0&&r.banner==='HOLE IN ONE',`reduced motion ace: banner kept, no confetti (${JSON.stringify(r)})`);await p.screenshot({path:'shots/reduced-ace.png'});
 await idle(p);ok(!errs.length,'no console errors (reduced) '+errs.join(';'));await ctx.close()}
// 5. fast play toggle persists and shortens shots
{const {ctx,p}=await fresh();await p.click('#b-menu');await p.click('#b-fast');const label=await p.textContent('#b-fast');await p.click('#b-menuclose');
 const t=await p.evaluate(async()=>{CUH.rig(4,4);const t0=performance.now();document.getElementById('b-roll').click();await new Promise(r=>{const f=()=>CUH.anim.busy?requestAnimationFrame(f):r();requestAnimationFrame(f)});return performance.now()-t0});
 await p.reload();const kept=await p.evaluate(()=>localStorage.getItem('cuhgolf.fastplay'));
 ok(label==='Fast play: On'&&kept==='1',`fast play toggles and is saved (${label}, stored ${kept})`);ok(t<1500,`fast play tee shot ${Math.round(t)}ms`);
 const mb=await p.evaluate(()=>{document.getElementById('b-continue').click();document.getElementById('b-menu').click();const r=document.getElementById('b-fast').getBoundingClientRect();return r.height});ok(mb>=44,`fast play button ${mb}px tall`);await ctx.close()}
// 6. rare paths: stuck-bounce toast, odd putt toast, bunker 'didn't get out', -1 tag on the die while rolling from sand
{const {ctx,p,errs}=await fresh({},0);const shot=async(...d)=>{await p.evaluate(d=>{CUH.rig(...d);document.getElementById('b-roll').click()},d)};
 const toastAfter=async()=>{await idle(p);return p.evaluate(()=>document.querySelector('.toast.on')?.textContent||document.querySelector('.toast')?.textContent)};
 await shot(4,5);await idle(p);                       // Kyle (Safe, 12 pegs) to peg 9
 await p.click('.tier[data-lane="2"]');await shot(3,3);await idle(p); // Brooke (Aggressive) into the bunker at 6
 await shot(6);let t=await toastAfter();let g=await G(p);ok(g.lie[0].pos===10&&/1 peg closer/.test(t),`stuck bounce: peg 10, toast "${t}"`);
 await shot(3);t=await toastAfter();ok(/Odd/.test(t),`odd putt toast "${t}"`);
 await shot(4);await idle(p);                            // Kyle putts in, Brooke's turn from the bunker
 await shot(1);await p.waitForFunction(()=>CUH.anim.phase==='tumble',null,{polling:'raf'});
 const tags=await p.evaluate(()=>({tray:!!document.querySelector('.tray-tag'),panel:!!document.querySelector('#d1 .dtag')}));
 ok(tags.tray&&tags.panel,`-1 tag on the rolling die in the bunker ${JSON.stringify(tags)}`);await p.screenshot({path:'shots/bunker-roll-tag.png'});
 t=await toastAfter();g=await G(p);ok(g.lie[1].state==='bunker'&&g.lie[1].pos===6&&/Didn't get out/.test(t),`bunker roll 1: still in sand, toast "${t}"`);
 ok(!errs.length,'no console errors (rare paths) '+errs.join(';'));await ctx.close()}
await b.close();console.log(fails.length?`\n${fails.length} FAILED`:'\nall behaviour checks passed');process.exit(fails.length?1:0);
