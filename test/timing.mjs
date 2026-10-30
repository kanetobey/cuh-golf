// Prints per-phase timestamps for each shot type (normal, or --fast). Needs the local server on :8765.
import { chromium } from 'playwright';
const fast=process.argv.includes('--fast');
const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:390,height:844}});
await p.goto('http://127.0.0.1:8765/index.html');await p.evaluate(f=>{localStorage.clear();if(f)localStorage.setItem('cuhgolf.fastplay','1')},fast);await p.reload();
await p.click('#b-new');await p.click('#b-start');await p.click('#b-next');await p.click('.tier[data-lane="0"]');
const run=async(d)=>{const t0=await p.evaluate(d=>{CUH.rig(...d);document.getElementById('b-roll').click();return Math.round(performance.now())},d);
 await p.waitForFunction(()=>!CUH.anim.busy,null,{polling:'raf',timeout:10000});
 const m=(await p.evaluate(()=>CUH.anim.marks)).filter(x=>x[1]>=t0);return m.map((x,i)=>`${x[0]} ${x[1]-t0}`).join(' | ')};
console.log((fast?'FAST ':'')+'tee 4+4:',await run([4,4]));
await p.click('.tier[data-lane="0"]');console.log((fast?'FAST ':'')+'tee 2+3 (Brooke):',await run([2,3]));
console.log((fast?'FAST ':'')+'single 3 (Kyle):',await run([3]));
// putts: Brooke from 7 (Safe) rolls 4 -> 11 (green); then putt odd, putt even
await p.click('.tier[data-lane="0"]').catch(()=>{});
console.log((fast?'FAST ':'')+'Brooke 4 to green:',await run([4]));
console.log((fast?'FAST ':'')+'putt odd:',await run([3]));
console.log((fast?'FAST ':'')+'putt even:',await run([4]));
await b.close();
