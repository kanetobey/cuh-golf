/* ---------------- UI ---------------- */
// Event wiring. The roll button calls the engine (state changes and saves at once), then hands the outcome to Anim
// and redraws when the animation ends or is skipped.
function onRoll(){
 if(!G||Anim.busy||performance.now()<Anim.guardUntil)return;
 const o=shoot();if(!o)return;
 $('b-roll').disabled=true;
 Anim.play(o).then(()=>afterShot(o));
}
function afterShot(o){if(!G)return;renderBalls();renderPanel();applyCamera();
 if(G.phase==='holeDone'&&!$('s-play').hidden)showHoleResult()}
// Tap anywhere (or Escape / Space / Enter) skips the running animation. A short guard stops that same tap from
// also pressing Roll for the next player.
document.addEventListener('pointerdown',()=>{if(Anim.busy)Anim.skip()},true);
document.addEventListener('keydown',e=>{if(Anim.busy&&(e.key==='Escape'||e.key===' '||e.key==='Enter')){Anim.skip();e.preventDefault()}},true);
// A hidden tab pauses requestAnimationFrame: finish instantly so the board is current when the player comes back.
document.addEventListener('visibilitychange',()=>{if(document.hidden&&Anim.busy)Anim.skip()});
window.addEventListener('pagehide',()=>{if(Anim.busy)Anim.skip()});

$('b-next').addEventListener('click',()=>{$('o-hole').hidden=true;const r=advanceAfterCard();
 if(r==='play'){renderPanel();return}if(r==='final'){showFinal();return}renderBalls();renderPanel();applyCamera()});
$('b-card').addEventListener('click',()=>{$('oc-table').innerHTML=cardHTML();$('o-card').hidden=false});
$('b-cardclose').addEventListener('click',()=>$('o-card').hidden=true);
$('b-again').addEventListener('click',()=>{$('o-final').hidden=true;try{localStorage.removeItem(SAVE)}catch(e){}G=null;openSetup()});
$('b-rules').addEventListener('click',()=>$('o-rules').hidden=false);$('b-menurules').addEventListener('click',()=>{$('o-menu').hidden=true;$('o-rules').hidden=false});
$('b-rulesclose').addEventListener('click',()=>$('o-rules').hidden=true);
function syncFast(){const b=$('b-fast');b.setAttribute('aria-pressed',Anim.fast);b.textContent=`Fast play: ${Anim.fast?'On':'Off'}`}
$('b-menu').addEventListener('click',()=>{syncFast();$('o-menu').hidden=false});$('b-menuclose').addEventListener('click',()=>$('o-menu').hidden=true);
$('b-fast').addEventListener('click',()=>{Anim.setFast(!Anim.fast);syncFast()});
$('b-menuquit').addEventListener('click',()=>{$('o-menu').hidden=true;save();showTitle()});
$('b-roll').addEventListener('click',onRoll);
$('tee-pick').addEventListener('click',e=>{const b=e.target.closest('.tier');if(!b||Anim.busy||performance.now()<Anim.guardUntil)return;
 if(!pickLane(b.dataset.lane))return;renderBalls();renderPanel();if(camMode==='ball')applyCamera()});
document.querySelectorAll('.camset button').forEach(b=>b.addEventListener('click',()=>{camMode=b.dataset.cam;document.querySelectorAll('.camset button').forEach(x=>x.setAttribute('aria-pressed',x===b));applyCamera()}));

/* ---- SETUP ---- */
let setup=[];
const DEFAULT_NAMES=['Kyle','Brooke','Kane','Cole'];
function openSetup(){setup=[{name:'Kyle',color:'red'},{name:'Brooke',color:'yellow'}];renderSetup();showScreen('s-setup')}
function renderSetup(){$('prows').innerHTML=setup.map((p,i)=>`<div class="prow">
 <input id="pn${i}" aria-label="Player ${i+1} name" value="${p.name.replace(/"/g,'&quot;')}" maxlength="14" placeholder="Name">
 <div class="swatches" role="group" aria-label="Tee color">${Object.keys(COLORS).map(c=>`<button class="sw" data-i="${i}" data-c="${c}" style="--c:${COLORS[c]}" aria-label="${c}" aria-pressed="${p.color===c}" ${setup.some((q,j)=>j!==i&&q.color===c)?'disabled':''}></button>`).join('')}</div>
 </div>`).join('');
 $('pcount').textContent=`${setup.length} of 4`;$('b-addp').disabled=setup.length>=4;
 $('prows').querySelectorAll('.sw').forEach(b=>b.addEventListener('click',()=>{syncSetup();setup[b.dataset.i].color=b.dataset.c;renderSetup()}))}
function syncSetup(){setup.forEach((p,i)=>{p.name=$('pn'+i).value.trim()||`Player ${i+1}`})}
$('b-addp').addEventListener('click',()=>{syncSetup();const used=setup.map(p=>p.color);const c=Object.keys(COLORS).find(k=>!used.includes(k));setup.push({name:DEFAULT_NAMES[setup.length]||`Player ${setup.length+1}`,color:c});renderSetup()});
$('b-back').addEventListener('click',showTitle);
$('b-start').addEventListener('click',()=>{syncSetup();newGame(setup.map(p=>({...p})));camMode='hole';document.querySelectorAll('.camset button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.cam==='hole'));enterPlay()});
$('b-new').addEventListener('click',openSetup);
$('b-continue').addEventListener('click',()=>{G=load();if(G){G.busy=false;if(!G.active)G.active=G.players.map((_,i)=>i);enterPlay()}});
