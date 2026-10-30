// Headless test pass: every viewport plays a rigged hole (water, flight, bunker, bounce, birdie, par), the
// hole-complete card and a forced ace, screenshots each moment and checks layout + console errors.
//   node run.mjs [--url http://127.0.0.1:8765/index.html] [--only 390x844]
// Uses the locally installed Google Chrome (channel 'chrome').
import { chromium } from 'playwright';
import fs from 'fs';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d};
const URL=arg('--url','http://127.0.0.1:8765/index.html');const ONLY=arg('--only',null);
const VIEWPORTS=[[320,568,'iPhone SE 1st'],[375,667,'iPhone SE'],[390,844,'iPhone 14'],[430,932,'Pro Max'],[768,1024,'iPad'],[844,390,'phone landscape'],[1280,800,'laptop'],[1920,1080,'desktop']]
 .filter(v=>!ONLY||`${v[0]}x${v[1]}`===ONLY);
fs.mkdirSync('shots',{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const report=[],lowPowerSeen=[];
async function check(page,tag,errs){
 return page.evaluate(tag=>{const out=[];const W=innerWidth,H=innerHeight;const de=document.documentElement;
  if(de.scrollWidth>W+1)out.push(`horizontal scroll ${de.scrollWidth}>${W}`);if(de.scrollHeight>H+1)out.push(`vertical page scroll ${de.scrollHeight}>${H}`);
  const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&+cs.opacity>0.05&&!e.closest('[hidden]')};
  const R=e=>e.getBoundingClientRect();
  // toasts/banners/cards slide and scale in; judge them by their resting layout box, not a mid-transition frame
  const layoutRect=e=>{if(!/toast|banner|minicard/.test(e.className))return R(e);const p=e.offsetParent.getBoundingClientRect();const l=p.left+e.offsetLeft,t=p.top+e.offsetTop;return{left:l,top:t,right:l+e.offsetWidth,bottom:t+e.offsetHeight}};const inter=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
  const stage=document.querySelector('.stage'),sr=R(stage),roll=document.getElementById('b-roll');
  for(const sel of ['.toast.on','.banner','.minicard','.tray-bg','.pegchip']){for(const e of document.querySelectorAll(sel)){if(!vis(e))continue;const r=layoutRect(e);
   if(r.left<sr.left-1||r.right>sr.right+1||r.top<sr.top-1||r.bottom>sr.bottom+1)out.push(`${sel} outside stage [${r.left|0},${r.top|0},${r.right|0},${r.bottom|0}] vs [${sr.left|0},${sr.top|0},${sr.right|0},${sr.bottom|0}]`);
   if(vis(roll)&&inter(r,R(roll)))out.push(`${sel} overlaps roll button`);
   if(e.scrollWidth>e.clientWidth+1)out.push(`${sel} text overflows its box`)}}
  // banners/toast shouldn't sit on the camera buttons either
  const cs=document.querySelector('.camset');if(vis(cs))for(const sel of ['.toast.on','.banner']){for(const e of document.querySelectorAll(sel))if(vis(e)&&inter(layoutRect(e),R(cs)))out.push(`${sel} overlaps camera buttons`)}
  const mc=document.querySelector('.minicard');if(vis(mc)){const m=layoutRect(mc);if(vis(cs)&&inter(m,R(cs)))out.push('minicard overlaps camera buttons');for(const e of document.querySelectorAll('.banner'))if(vis(e)&&inter(layoutRect(e),m))out.push('banner overlaps minicard')}
  for(const e of document.querySelectorAll('.topbar > *')){if(!vis(e))continue;const r=R(e);if(r.right>W+1||r.left<-1)out.push(`topbar item off screen: ${e.className||e.id}`)}
  for(const b of document.querySelectorAll('button')){if(!vis(b))continue;const r=R(b);if(r.height<43.5)out.push(`button under 44px tall: ${b.id||b.className||b.textContent.trim().slice(0,20)} (${r.height|0}px)`)}
  const ov=[...document.querySelectorAll('.ov')].find(o=>!o.hidden);if(ov){const c=ov.querySelector('.card');const r=R(c);if(r.right>W+1||r.left<-1)out.push('overlay card off screen')}
  return out},tag).then(issues=>{if(errs.length){issues.push(...errs.splice(0).map(e=>'console: '+e))}return issues})}
const waitPhase=(page,ph,t=8000)=>page.waitForFunction(ph=>(window.CUH&&CUH.anim.phase)===ph,ph,{timeout:t,polling:'raf'});
const waitIdle=(page,t=12000)=>page.waitForFunction(()=>window.CUH&&!CUH.anim.busy,null,{timeout:t,polling:50});
for(const [w,h,label] of VIEWPORTS){
 const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,hasTouch:w<768,isMobile:false});
 const page=await ctx.newPage();const errs=[];page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});page.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
 const vp=`${w}x${h}`;const shots=[];const issues={};
 const snap=async(name)=>{const f=`shots/${vp}-${name}.png`;await page.screenshot({path:f});shots.push([name,f]);const iss=await check(page,name,errs);if(iss.length)issues[name]=iss};
 const roll=async(...dice)=>{await page.evaluate(d=>CUH.rig(...d),dice);await page.click('#b-roll')};
 const pick=lane=>page.click(`.tier[data-lane="${lane}"]`);
 await page.goto(URL);await page.evaluate(()=>{try{localStorage.clear()}catch(e){}});await page.reload();
 await snap('title');
 await page.click('#b-new');await page.click('#b-start');await snap('round-start');await page.click('#b-next');
 // Kyle: Aggressive, 2+2 -> water at peg 4
 await pick(2);await snap('tee-pick-done');
 await roll(2,2);await waitPhase(page,'tumble');await page.waitForTimeout(350);await snap('1-tumble');
 await waitPhase(page,'water');await page.waitForTimeout(260);await snap('2-water');
 await waitPhase(page,'water-back');await page.waitForTimeout(350);await snap('2b-water-ghost');await waitIdle(page);
 // Brooke: Safe, 4+4 -> fairway, mid-flight
 await pick(0);await roll(4,4);await waitPhase(page,'flight');await page.waitForTimeout(290);await snap('3-midflight');
 await waitPhase(page,'land');await page.waitForTimeout(450);await snap('3b-land');await waitIdle(page);
 // Kyle: 3+3 -> bunker at peg 6
 await roll(3,3);await waitPhase(page,'bunker');await page.waitForTimeout(420);await snap('4-bunker');await waitIdle(page);
 // Brooke: from 8 roll 6 -> past the cup, bounces back to 10
 await roll(6);await waitPhase(page,'bounce');await page.waitForTimeout(200);await snap('5-bounce');await waitIdle(page);await page.waitForTimeout(100);await snap('5b-after-bounce');
 // Brooke putts 2 (even) -> holed in 3, birdie
 await roll(2);await waitPhase(page,'birdie');await page.waitForTimeout(820);await snap('6-birdie');await waitIdle(page);
 // Kyle from the bunker: 5-1 = 4 -> holed in 4, par; that ends the hole
 await roll(5);await waitPhase(page,'par');await page.waitForTimeout(330);await snap('7-par');await waitIdle(page);
 await page.waitForSelector('#o-hole:not([hidden])');await page.waitForTimeout(150);await snap('8-hole-card');
 // Hole 2: Brooke has the honors; Safe is lane 3 there (12 pegs) -> 6+6 = hole in one
 await page.click('#b-next');await page.waitForTimeout(950);
 const lp=await page.evaluate(()=>{const v=CUH.anim.lowPower;CUH.anim.lowPower=false;return v});lowPowerSeen.push(`${vp}:${lp}`);
 await pick(3);await roll(6,6);await waitPhase(page,'ace',9000);await page.waitForTimeout(1000);await snap('9-ace');
 // tap anywhere skips; state must already be right
 await page.mouse.click(Math.round(w/2),Math.round(h/3));await waitIdle(page,3000);
 const st=await page.evaluate(()=>({score:CUH.G.scores[1][1],turnName:CUH.G.players[CUH.G.order[CUH.G.turn]].name,busy:CUH.anim.busy,roll:document.getElementById('b-roll').disabled}));
 if(st.score!==1||st.turnName!=='Kyle')issues['ace-skip']=[`state after skip wrong: ${JSON.stringify(st)}`];
 await snap('10-after-skip');
 report.push({vp,label,issues,shots:shots.map(s=>s[1])});
 console.log(`${vp.padEnd(10)} ${label.padEnd(16)} ${Object.keys(issues).length?'ISSUES':'ok'}`);for(const [k,v] of Object.entries(issues))for(const i of v)console.log(`    [${k}] ${i}`);
 await ctx.close();
}
fs.writeFileSync('shots/report.json',JSON.stringify(report,null,1));
// contact sheets, one per viewport, for eyeballing
const sheet=await browser.newPage({viewport:{width:1800,height:900}});
for(const r of report){const imgs=r.shots.filter(f=>!/title|round-start|tee-pick|10-after/.test(f));const [w,h]=r.vp.split('x').map(Number);
 const cols=w>h?4:imgs.length;const cw=Math.floor(1760/cols);
 await sheet.setContent(`<body style="margin:0;background:#222;font:12px sans-serif;color:#eee"><div style="display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:6px;padding:6px">${imgs.map(f=>`<figure style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:100%;display:block"><figcaption>${f.split('-').slice(1).join('-')}</figcaption></figure>`).join('')}</div></body>`);
 await sheet.screenshot({path:`shots/sheet-${r.vp}.png`,fullPage:true})}
await browser.close();
console.log('low-power flag before ace (headless frame drops):',lowPowerSeen.join(' '));
const total=report.reduce((a,r)=>a+Object.values(r.issues).flat().length,0);console.log(`\n${report.length} viewports, ${total} issues`);process.exit(total?1:0);
