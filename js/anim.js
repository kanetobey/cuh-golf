/* ---------------- ANIMATION ---------------- */
// Owns all shot and moment timing. Purely cosmetic: shoot() has already updated and saved G before play() runs, so
// skipping, a background tab, a resize or an error in here can never leave the game state wrong.
// Motion uses transform and opacity only (plus one stroke-dashoffset for the hand-drawn score circle), driven by a
// single requestAnimationFrame loop. Course effects live in the SVG camera space (#fx); HTML effects live in .fxl and
// are sized from the stage, so everything scales with the screen.
const Anim=(()=>{
const NS='http://www.w3.org/2000/svg',FAST_KEY='cuhgolf.fastplay';
const S={busy:false,skipping:false,phase:'idle',guardUntil:0,lowPower:false,fast:false};
try{S.fast=localStorage.getItem(FAST_KEY)==='1'}catch(e){}
// Start in low power only on genuinely weak devices; anything else is judged by measured frame times during play.
try{const n=navigator,m=n.deviceMemory||4;S.lowPower=!!((n.connection&&n.connection.saveData)||m<=1||((n.hardwareConcurrency||4)<=2&&m<=2))}catch(e){}
const spd=()=>S.fast?0.4:1;
// phase marks (read by the tests through CUH.anim.marks)
const marks=[];function mark(p){S.phase=p;marks.push([p,Math.round(performance.now())]);if(marks.length>60)marks.shift()} // Fast play cuts every timing by 60%
const setSpdVar=()=>document.documentElement.style.setProperty('--spd',spd());setSpdVar();
function setFast(v){S.fast=!!v;try{localStorage.setItem(FAST_KEY,S.fast?'1':'0')}catch(e){}setSpdVar()}
// Sound hooks. Each cue name marks where a sound belongs; set window.CUH_SOUND=name=>{...} to play them.
function cue(name){try{window.CUH_SOUND&&window.CUH_SOUND(name)}catch(e){}}

/* ---- easing ---- */
const lin=t=>t,inQuad=t=>t*t,outQuad=t=>t*(2-t),outCubic=t=>1-(1-t)**3,inOutSine=t=>-(Math.cos(Math.PI*t)-1)/2;
const backOut=t=>{const c1=1.70158,c3=c1+1;return 1+c3*(t-1)**3+c1*(t-1)**2};
function bez(x1,y1,x2,y2){const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
 const X=t=>((ax*t+bx)*t+cx)*t,Y=t=>((ay*t+by)*t+cy)*t,dX=t=>(3*ax*t+2*bx)*t+cx;
 return x=>{if(x<=0)return 0;if(x>=1)return 1;let t=x;for(let i=0;i<8;i++){const e=X(t)-x,d=dX(t);if(Math.abs(e)<1e-5)break;if(Math.abs(d)<1e-6){t=NaN;break}t-=e/d}
  if(!(t>=0&&t<=1)){let lo=0,hi=1;t=x;for(let i=0;i<24;i++){X(t)<x?lo=t:hi=t;t=(lo+hi)/2}}return Y(t)}}
const eTumble=bez(.2,.8,.3,1);
const CAM_EASE='cubic-bezier(.3,.8,.3,1)';

/* ---- tween engine: one rAF loop; skip() completes everything at its end state ---- */
// Chained steps start exactly where the previous one ended (lastEnd), so a 3.0s sequence takes 3.0s, not 3.0s plus
// a frame of latency per step. Low power = sustained slow frames (median over a shot), not the odd spike.
const live=new Set();let raf=0,lastT=0,lastEnd=-1e9;const dts=[];
function frame(now){raf=0;if(lastT)dts.push(now-lastT);lastT=now;
 for(const t of [...live]){if(t.t0==null)t.t0=now;const p=t.dur>0?Math.min(1,(now-t.t0)/t.dur):1;step(t,p);if(p>=1)fin(t)}
 if(live.size)raf=requestAnimationFrame(frame);else lastT=0}
function step(t,p){try{t.fn(t.ease(p),p)}catch(e){console.error(e)}}
function fin(t){live.delete(t);if(t.t0!=null)lastEnd=Math.max(lastEnd,t.t0+t.dur);t.res()}
function tween(ms,fn,ease=lin){const dur=ms*spd();return new Promise(res=>{const t={dur,fn,ease,res,t0:null};
 if(S.skipping||dur<=0){step(t,1);res();return}const now=performance.now();if(now-lastEnd<150)t.t0=lastEnd;live.add(t);if(!raf)raf=requestAnimationFrame(frame)})}
const wait=ms=>tween(ms,()=>{});
const after=(ms,f)=>wait(ms).then(f);
function skip(){if(!S.busy||S.skipping)return;S.skipping=true;cue('skip');for(const t of [...live]){step(t,1);fin(t)}
 if(raf){cancelAnimationFrame(raf);raf=0}lastT=0;if(CAM)setCam(CAM,0);S.guardUntil=performance.now()+450}

/* ---- element helpers ---- */
let fx=null,layer=null;
function sv(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);(parent||fx).appendChild(e);return e}
function el(cls,parent,text){const e=document.createElement('div');e.className=cls;if(text!=null)e.textContent=text;(parent||layer).appendChild(e);return e}
const f2=n=>(+n).toFixed(2);
// place an SVG group at course point (x,y), oriented to the screen, scaled
function tf(e,x,y,s=1,sx=1,sy=1){e.setAttribute('transform',`translate(${f2(x)} ${f2(y)}) rotate(${-curRot}) scale(${f2(s*sx)} ${f2(s*sy)})`)}
// screen-space vector -> course-space vector (undo camera rotation)
function sv2c(x,y){const a=-curRot*Math.PI/180;return{x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}}
function c2sv(x,y){const a=curRot*Math.PI/180;return{x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}}
const lerp=(a,b,t)=>a+(b-a)*t,lerpP=(A,B,t)=>({x:lerp(A.x,B.x,t),y:lerp(A.y,B.y,t)});
// point at fraction t along a polyline of course points
function along(pts,t){if(pts.length<2)return{...pts[0]};const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y));
 const d=t*L[L.length-1];let i=1;while(i<L.length-1&&L[i]<d)i++;const seg=(L[i]-L[i-1])||1;return lerpP(pts[i-1],pts[i],Math.min(1,Math.max(0,(d-L[i-1])/seg)))}

/* ---- the flying ball: sprite + ground shadow ---- */
function makeBall(color,sunk){const sh=sv('circle',{r:7,fill:'#0b1f18',opacity:.3});const g=sv('g',{});
 sv('circle',{r:7,fill:color,stroke:'#1b1a17','stroke-width':1.5},g);
 const sand=sv('g',{opacity:sunk?1:0},g);sv('path',{d:'M-8.6,0.6 A8.6,8.6 0 0 0 8.6,0.6 Z',fill:'#f0cb8f'},sand);sv('ellipse',{cy:1,rx:11,ry:4.2,fill:'none',stroke:'#c9a060','stroke-width':1.6},sand);
 return{g,sh,sand,x:0,y:0}}
const SHOFF=()=>sv2c(1.6,2.2);
// lift = height in course units along the arc's bow direction; shadow stays on the ground point
function place(b,x,y,{lift=0,dir=null,s=1,sx=1,sy=1,o=1}={}){b.x=x;b.y=y;const lx=dir?dir.x*lift:0,ly=dir?dir.y*lift:0;
 tf(b.g,x+lx,y+ly,s,sx,sy);b.g.setAttribute('opacity',f2(o));const h=Math.min(1,lift/60),so=SHOFF();
 tf(b.sh,x+so.x*(1+lift*.08),y+so.y*(1+lift*.08),1-.3*h);b.sh.setAttribute('opacity',f2(.3*(1-.55*h)*o))}

/* ---- rings, puffs, dots ---- */
function ring(x,y,{r=8,color='#fff',w=2,dash=null,o=1}={}){const c=sv('circle',{r,fill:'none',stroke:color,'stroke-width':w,'vector-effect':'non-scaling-stroke',opacity:o,transform:`translate(${f2(x)} ${f2(y)})`});if(dash)c.setAttribute('stroke-dasharray',dash);return c}
function ripple(x,y,ms,{color='#fff',s0=.5,s1=2.8,r=8,w=2,delay=0,op=.95,ease=outCubic}={}){const c=ring(x,y,{r,color,w,o:0});
 return wait(delay).then(()=>tween(ms,e=>{c.setAttribute('transform',`translate(${f2(x)} ${f2(y)}) scale(${f2(s0+(s1-s0)*e)})`);c.setAttribute('opacity',f2(op*(1-e)))},ease)).then(()=>c.remove())}
function puff(x,y,ms,{n=7,color='#f0cb8f',spread=13,size=4}={}){const ps=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2+Math.random()*.5,d=spread*(.6+Math.random()*.5);
  ps.push({c:sv('circle',{r:size*(.7+Math.random()*.6),fill:i%2?color:'#e2bd7e',opacity:0}),dx:Math.cos(a)*d,dy:Math.sin(a)*d*.6})}
 return tween(ms,e=>{for(const p of ps){const v=sv2c(p.dx*e,p.dy*e-4*e);p.c.setAttribute('transform',`translate(${f2(x+v.x)} ${f2(y+v.y)}) scale(${f2(.5+1.1*e)})`);p.c.setAttribute('opacity',f2(.85*(1-e)))}},outCubic).then(()=>ps.forEach(p=>p.c.remove()))}
function spray(x,y,ms){const ds=[];for(let i=0;i<9;i++){const a=-Math.PI/2+(i/8-.5)*2.1,v=16+Math.random()*10;ds.push({c:sv('circle',{r:1.6+Math.random()*1.2,fill:i%3?'#cfe0ff':'#ffffff',opacity:0}),vx:Math.cos(a)*v,vy:Math.sin(a)*v})}
 return tween(ms,(e,p)=>{for(const d of ds){const sx=d.vx*p,sy=d.vy*p+22*p*p;const v=sv2c(sx,sy);d.c.setAttribute('transform',`translate(${f2(x+v.x)} ${f2(y+v.y)})`);d.c.setAttribute('opacity',f2(p<.15?p/.15:1-(p-.15)/.85))}}).then(()=>ds.forEach(d=>d.c.remove()))}
function shake(ms){if(reducedMotion())return Promise.resolve();return tween(ms,(e,p)=>{const a=4*(1-p);svg.style.transform=p>=1?'':`translate(${f2(a*Math.sin(p*46))}px,${f2(a*Math.cos(p*37))}px)`}).then(()=>{svg.style.transform=''})}
// gold dashes from peg i to the cup along the route
function previewDashes(R,i,ms=260){if(i>=R.last)return;const g=sv('g',{opacity:0});for(let k=i;k<R.last;k++){const a=R.pts[k],b=R.pts[k+1];sv('line',{x1:f2(a.x),y1:f2(a.y),x2:f2(b.x),y2:f2(b.y),stroke:'#ffd66b','stroke-width':2.4,'stroke-dasharray':'4 4','stroke-linecap':'round','vector-effect':'non-scaling-stroke'},g)}
 return tween(ms,e=>g.setAttribute('opacity',f2(.95*e)))}

/* ---- HTML layer: toast, banners, chip, minicard, flash, confetti ---- */
let toastEl=null,toastTimer=0;
function toast(text,kind=''){if(!layer)return;if(!toastEl){toastEl=el('toast');toastEl.setAttribute('role','status');toastEl.setAttribute('aria-live','polite')}
 clearTimeout(toastTimer);toastEl.className='toast '+kind;toastEl.textContent=text;void toastEl.offsetWidth;toastEl.classList.add('on');
 toastTimer=setTimeout(()=>toastEl&&toastEl.classList.remove('on'),2600*spd()+400)}
function hideToast(){clearTimeout(toastTimer);if(toastEl)toastEl.classList.remove('on')}
function banner(text,kind){const b=el('banner '+kind,layer,text);b.setAttribute('role','status');b.style.opacity='0';return b}
function popIn(b,ms=300,from=.4){return tween(ms,(e,p)=>{b.style.transform=`scale(${f2(from+(1-from)*e)})`;b.style.opacity=f2(Math.min(1,p*2.5))},backOut)}
function fadeOutLater(node,delay){node.classList.add('linger');setTimeout(()=>{node.classList.add('out');setTimeout(()=>node.remove(),450)},delay)}
let chipEl=null;
function chipAt(p,n){if(!chipEl)chipEl=el('pegchip');const s=toScreen(p);chipEl.textContent=n===1?'1 peg':`${n} pegs`;chipEl.style.transform=`translate(${f2(s.x)}px,${f2(s.y-12-9*CAM.k)}px) translate(-50%,-100%)`;chipEl.style.opacity='1'}
function chipTick(){if(!chipEl)return;chipEl.classList.remove('tick');void chipEl.offsetWidth;chipEl.classList.add('tick')}
function flash(color,ms,peak=.7){if(reducedMotion())return Promise.resolve();const f=el('flash');f.style.background=color;
 return tween(ms,(e,p)=>{f.style.opacity=f2(p<.22?peak*p/.22:peak*(1-(p-.22)/.78))}).then(()=>f.remove())}
function confetti(p,ms){if(reducedMotion()||S.lowPower||S.skipping)return Promise.resolve();const s=toScreen(p),cols=['#d2ad55','#d23b2a','#f6f2e8','#3b5ed8','#72bf4e','#f2c231'];
 const box=el('confetti'),scale=Math.max(.7,Math.min(1.5,Math.min(VW,VH)/420)),ps=[];
 for(let i=0;i<60;i++){const d=el('cf',box);d.style.background=cols[i%cols.length];const a=-Math.PI/2+(Math.random()-.5)*2.4,v=(260+Math.random()*320)*scale;
  if(i%3===0)d.style.borderRadius='50%';ps.push({d,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:Math.random()*720-360,ph:Math.random()*6,w:(.6+Math.random()*.8)})}
 return tween(ms,(e,t)=>{const T=t*ms*spd()/1000;for(const q of ps){const x=s.x+q.vx*T*.9+Math.sin(q.ph+T*6)*14*scale,y=s.y+q.vy*T+520*scale*T*T;
  q.d.style.transform=`translate(${f2(x)}px,${f2(y)}px) rotate(${f2(q.r*T)}deg) scale(${f2(q.w)},${f2(Math.abs(Math.cos(q.ph+T*9)))})`;q.d.style.opacity=f2(t<.7?1:1-(t-.7)/.3)}}).then(()=>box.remove())}
function miniCard(o){const pl=G.players[o.pi];const c=el('minicard');c.innerHTML=`<div class="mh"><span>HOLE ${o.hole+1}</span><span>PAR ${o.par}</span></div><div class="mr"><i style="--c:${COLORS[pl.color]}"></i><b></b><span class="cell"></span></div>`;
 c.querySelector('b').textContent=pl.name;return c}

/* ---- counter in the panel ---- */
function flipCounter(to,{blue=false,plus=0}={}){const n=$('w-strokes');if(!n)return Promise.resolve();
 if(reducedMotion()||S.skipping){n.textContent=to;return Promise.resolve()}
 if(plus>1){const t=el('plustag',n.parentElement,`+${plus}`);setTimeout(()=>t.remove(),1100)}
 return tween(140,e=>{n.style.transform=`perspective(200px) rotateX(${f2(90*e)}deg)`},inQuad).then(()=>{n.textContent=to;if(blue){n.classList.remove('blueflash');void n.offsetWidth;n.classList.add('blueflash')}
  return tween(160,e=>{n.style.transform=`perspective(200px) rotateX(${f2(-90+90*e)}deg)`},outQuad)}).then(()=>{n.style.transform=''})}

/* ---- camera helpers (respect skip / reduced motion) ---- */
function camTo(c,ms,ease=CAM_EASE){setCam(c,S.skipping?0:ms*spd(),ease)}
function inFrame(pts,c,pad=26){return pts.every(p=>{const s=toScreen(p,c);return s.x>=pad&&s.x<=VW-pad&&s.y>=TOPUI+8&&s.y<=VH-pad})}
function keepInFrame(pts,ms){if(!CAM||inFrame(pts,CAM))return;const f=fit(pts,34,CAM.rot,TOPUI,CAM.k);camTo(f,ms,'cubic-bezier(.45,0,.25,1)')}

/* ---- dice tray ---- */
function dieNode(parent,D){const w=el('tdie',parent);const face=el('face',w);el('pulse',w);w.style.width=w.style.height=D+'px';return{w,face}}
// bunker: the '−1' tag rides on the first die's corner but stays upright while the die spins
function tagNode(parent){return el('dtag tray-tag',parent,'−1')}
const moveTag=(t,x,y,D,s=1)=>{if(t)t.style.transform=`translate(${f2(x+D*.5*s-12)}px,${f2(y-D*.5*s-10)}px)`};
const randFace=()=>1+Math.floor(Math.random()*6);
async function dicePhase(o,mode){
 mark('tumble');cue('dice-tumble');
 const n=o.dice.length,D=Math.round(Math.max(38,Math.min(96,Math.min(VW,VH)*.16)));
 const cx=VW/2,cy=Math.round(TOPUI+(VH-TOPUI)*.5),gap=D*1.24;
 const tray=el('tray');const bg=el('tray-bg',tray);const bw=n*gap+D*.55,bh=D*1.62;
 bg.style.width=bw+'px';bg.style.height=bh+'px';bg.style.transform=`translate(${f2(cx-bw/2)}px,${f2(cy-bh/2-D*.12)}px)`;bg.style.opacity='0';
 const tot=el('ttotal',tray);tot.style.transform=`translate(${f2(cx)}px,${f2(cy+D*.62)}px) translate(-50%,0)`;tot.style.opacity='0';tot.style.fontSize=Math.round(Math.max(13,D*.27))+'px';
 const dice=o.dice.map(()=>dieNode(tray,D)),tag=o.penalty?tagNode(tray):null;
 const lines=[];dice.forEach(()=>{for(let i=0;i<3;i++){const l=el('sline',tray);l.style.height=Math.round(D*.5)+'px';lines.push(l)}});
 const ends=o.dice.map((_,k)=>cx+(k-(n-1)/2)*gap),starts=ends.map((x,k)=>x+(n===1?-D*.7:(k-.5)*D*1.3));
 const T=mode==='long'?700:mode==='short'?340:260,turns=mode==='long'?2.5:mode==='short'?1.5:1,jit=o.dice.map(()=>(Math.random()-.5)*26);
 const yStart=VH+D,yPeak=cy-D*1.15,b1=D*.3,b2=D*.11;
 const yAt=p=>p<.32?lerp(yStart,yPeak,outQuad(p/.32)):p<.55?lerp(yPeak,cy,inQuad((p-.32)/.23)):p<.78?cy-b1*Math.sin(Math.PI*(p-.55)/.23):cy-b2*Math.sin(Math.PI*(p-.78)/.22);
 const pd=[$('d1'),$('d2')];let lastFk=-1;const rot=[];
 await tween(T,(e,p)=>{const ms=p*T*spd(),fk=Math.floor(ms/(70*spd()));
  if(fk!==lastFk&&p<1){lastFk=fk;dice.forEach(d=>d.face.innerHTML=dieFace(randFace()));pd.forEach((d,k)=>{if(k<n&&d){d.hidden=false;d.classList.remove('blank');d.innerHTML=dieFace(randFace())+(o.penalty&&k===0?'<span class="dtag">−1</span>':'')}})}
  const y=yAt(p),r=eTumble(p);
  dice.forEach((d,k)=>{rot[k]=turns*360*r+jit[k]*Math.min(1,p*1.6);d.w.style.transform=`translate(${f2(lerp(starts[k],ends[k],r)-D/2)}px,${f2(y-D/2)}px) rotate(${f2(rot[k])}deg)`});
  moveTag(tag,lerp(starts[0],ends[0],r),y,D);
  lines.forEach((l,i)=>{const k=Math.floor(i/3),j=i%3;const lp=Math.min(1,ms/(300*spd()));l.style.opacity=f2(lp>=1?0:(1-lp)*.75);l.style.transform=`translate(${f2(lerp(starts[k],ends[k],r)+(j-1)*D*.28)}px,${f2(y+D*.55+lp*D*.35)}px)`})});
 lines.forEach(l=>l.remove());
 // settle: snap square side by side on the tray, 1.12 -> 1 back-out, gold pulse, total counts up
 mark('settle');cue('dice-settle');
 dice.forEach((d,k)=>d.face.innerHTML=dieFace(o.dice[k]));pd.forEach((d,k)=>{if(d&&k<n){d.innerHTML=dieFace(o.dice[k])+(o.penalty&&k===0?'<span class="dtag">−1</span>':'')}});
 const val=o.kind==='putt'?o.raw:o.mv,label=k=>o.kind==='putt'?`${o.raw} · ${o.raw%2===0?'Even':'Odd'}`:o.penalty?`${o.raw} − 1 = ${k}`:n===2?`${o.dice[0]} + ${o.dice[1]} = ${k}`:`${k} ${k===1?'peg':'pegs'}`;
 const ST=mode==='long'?150:mode==='short'?130:120;
 await tween(ST,(e,p)=>{const s=1.12-.12*backOut(p);bg.style.opacity=f2(Math.min(1,p*2));
  dice.forEach((d,k)=>{const r=lerp(rot[k],turns*360,outCubic(p));d.w.style.transform=`translate(${f2(ends[k]-D/2)}px,${f2(cy-D/2)}px) rotate(${f2(r)}deg) scale(${f2(s)})`;
   const pu=d.w.querySelector('.pulse');pu.style.opacity=f2(.95*(1-p));pu.style.transform=`scale(${f2(1+.3*p)})`});
  moveTag(tag,ends[0],cy,D,s);tot.style.opacity=f2(Math.min(1,p*2));tot.textContent=label(Math.round(val*Math.min(1,p*1.3)))});
 tot.textContent=label(val);
 await wait(mode==='long'?150:60);
 return{tray,D,slide:()=>tween(200,(e,p)=>{tray.style.transform=`translateY(${f2(D*.9*e)}px)`;tray.style.opacity=f2(1-p)},inQuad).then(()=>tray.remove())};
}

/* ---- shot pieces ---- */
function setup(o){const h=curH(),R=h.routes[o.lane],pl=G.players[o.pi];
 const real=cam.querySelector(`#balls [data-i="${o.pi}"]`);if(real)real.style.opacity='0';
 const b=makeBall(COLORS[pl.color],o.before.state==='bunker');const P0=R.pts[o.from];place(b,P0.x,P0.y);
 return{h,R,b,pt:i=>R.pts[i],cur:o.from}}
// bow direction of an arc: perpendicular to the flight, toward the top-right of the screen
function bowDir(A,B){const dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy)||1;let px=-dy/L,py=dx/L;const s=c2sv(px,py);if(s.x*.6-s.y*.8<0){px=-px;py=-py}return{x:px,y:py}}
async function launchAndFly(o,c,tray){
 const A=c.pt(o.from),B=c.pt(o.carry),E=c.pt(o.forward.length?o.forward[o.forward.length-1]:o.carry);
 const dir=bowDir(A,B),dist=Math.hypot(B.x-A.x,B.y-A.y),H=Math.max(14,Math.min(90,dist*.3));
 const N=Math.max(8,Math.min(26,Math.round(dist/9))),us=Array.from({length:N},(_,i)=>(i+1)/(N+1));
 const arcAt=u=>{const g=lerpP(A,B,u),l=H*Math.sin(Math.PI*u);return{x:g.x+dir.x*l,y:g.y+dir.y*l}};
 const ahead=us.map(u=>{const q=arcAt(u);return sv('circle',{cx:f2(q.x),cy:f2(q.y),r:1.7,fill:'#ffffff',opacity:0})});
 const trail=us.map(u=>{const q=arcAt(u);return sv('circle',{cx:f2(q.x),cy:f2(q.y),r:2.5,fill:'#fff6d6',opacity:0})});
 const gold=ring(B.x,B.y,{r:9,color:'#ffd66b',w:2.5,o:0}),dash=(o.hops.length?ring(E.x,E.y,{r:9,color:'#ffffff',w:2,dash:'3 3',o:0}):null);
 // Launch 300ms: tray slides away, dotted arc draws (200ms), rings appear, ball grows 25% and lifts off its shadow (ease-in quad)
 mark('launch');cue('launch');
 await Promise.all([tray.slide(),tween(300,(e,p)=>{const k=Math.min(1,p*1.5);ahead.forEach((d,i)=>d.setAttribute('opacity',i/N<=k?'.8':'0'));
  gold.setAttribute('opacity',f2(k));if(dash)dash.setAttribute('opacity',f2(k*.9));const q=inQuad(p);place(c.b,A.x,A.y,{lift:5*q,dir,s:1+.25*q});c.b.sand.setAttribute('opacity',f2(+c.b.sand.getAttribute('opacity')*(1-p)))})]);
 // Flight 600ms: ease-in-out sine along the arc, 175% at the peak, shadow on the ground line; solid trail fades over 400ms
 mark('flight');cue('flight');
 keepInFrame([A,B,E,arcAt(.5)],500);
 const passed=new Array(N).fill(null),FL=600,TOT=FL+400,ff=FL/TOT;
 const trailP=tween(TOT,(e,p)=>{const u=inOutSine(Math.min(1,p/ff));us.forEach((ui,i)=>{if(ui<=u&&passed[i]==null)passed[i]=p;if(passed[i]!=null)trail[i].setAttribute('opacity',f2(Math.max(0,1-(p-passed[i])/(1-ff))))})});
 await tween(FL,(u,p)=>{const g=lerpP(A,B,u);place(c.b,g.x,g.y,{lift:H*Math.sin(Math.PI*u)+5*(1-u),dir,s:lerp(1.25,1,u)+.625*Math.sin(Math.PI*u)});
  us.forEach((ui,i)=>{if(ui<=u)ahead[i].setAttribute('opacity','0')})},inOutSine);
 c.cur=o.carry;cue('touchdown');
 return{trailP,cleanup:()=>{gold.remove();dash&&dash.remove()}};
}
async function rollTo(o,c){ // single-die: roll along the pegs to the carry peg
 const idx=o.forward.indexOf(o.carry);if(idx<0)return;const pts=[c.pt(o.from),...o.forward.slice(0,idx+1).map(c.pt)];
 mark('roll');cue('roll');keepInFrame(pts.concat(o.hops.map(c.pt),o.back.map(c.pt)),300);
 const n=pts.length-1;let shown=0;
 await tween(Math.max(140,Math.min(300,n*65)),(e)=>{const q=along(pts,e);place(c.b,q.x,q.y);c.b.sand.setAttribute('opacity',f2(+c.b.sand.getAttribute('opacity')*(1-e)));
  const k=Math.min(n,Math.floor(e*n+1e-6));if(k>shown){shown=k;chipAt(q,k);chipTick()}},inOutSine);
 c.cur=o.carry}
async function hops(o,c,dur,sq=70){
 if(!o.hops.length)return;mark('hops');let n=o.carry-o.from;chipAt(c.pt(o.carry),n);
 for(const k of o.hops){const A=c.pt(c.cur),B=c.pt(k),dir=sv2c(0,-1),hh=6.5;cue('hop');
  await tween(dur,(e,p)=>{const g=lerpP(A,B,e);place(c.b,g.x,g.y,{lift:hh*Math.sin(Math.PI*p),dir})},outQuad);
  c.cur=k;n++;chipAt(B,n);chipTick();
  await tween(sq,(e,p)=>place(c.b,B.x,B.y,{sx:1.22-.22*p,sy:.8+.2*p}))}}
async function bounceBack(o,c){
 mark('bounce');cue('lip-out');const C=c.pt(c.R.last),A=c.pt(c.cur);
 const a0=Math.atan2(A.y-C.y,A.x-C.x);const flag=cam.querySelector('#flag'+c.h.n);
 const wob=flag?tween(560,(e,p)=>flag.setAttribute('transform',`rotate(${f2(13*Math.sin(p*Math.PI*4)*(1-p))} ${f2(C.x)} ${f2(C.y)})`)).then(()=>flag.removeAttribute('transform')):Promise.resolve();
 await tween(240,(e)=>{const a=a0+e*Math.PI*2,r=6.5;place(c.b,C.x+Math.cos(a)*r,C.y+Math.sin(a)*r)});
 const pts=[C,...o.back.map(c.pt)];
 if(pts.length>1)await tween(Math.max(220,Math.min(520,o.back.length*90)),e=>{const q=along(pts,e);place(c.b,q.x,q.y)},outCubic);
 c.cur=o.landing;const F=c.pt(o.landing);ripple(F.x,F.y,320,{color:'#e9dcb4',s0:.4,s1:1.9,w:1.5});await wob}
function dropIn(c,{ace=false}={}){const C=c.pt(c.R.last),A={x:c.b.x,y:c.b.y};cue('cup');
 // ace: 120ms of slow motion at the lip, then the drop
 const slow=ace?tween(120,e=>{const g=lerpP(A,C,.15*e);place(c.b,g.x,g.y,{s:1-.05*e})}):Promise.resolve();
 return slow.then(()=>tween(ace?200:170,e=>{const g=lerpP(A,C,ace?.15+.85*e:e);place(c.b,g.x,g.y,{s:1-.5*e,o:1-e})},inQuad))}
function curlIn(c){const C=c.pt(c.R.last),A={x:c.b.x,y:c.b.y};const a0=Math.atan2(A.y-C.y,A.x-C.x),r0=Math.max(5,Math.hypot(A.x-C.x,A.y-C.y));cue('cup');
 return tween(260,e=>{const a=a0+e*Math.PI*3,r=r0*(1-e);place(c.b,C.x+Math.cos(a)*r,C.y+Math.sin(a)*r,{s:1-.45*e,o:e<.75?1:1-(e-.75)/.25})},inQuad)}

/* ---- moments ---- */
async function landMoment(o,c,long){
 mark('land');cue('land');const F=c.pt(c.cur);
 const rs=[ripple(F.x,F.y,long?400:200,{s1:2.6}),long?ripple(F.x,F.y,400,{s1:3.6,delay:90,op:.7}):null];
 if(long&&o.state!=='tee')camTo(ballCam(c.R.pts,o.pos,c.h),600,CAM_EASE);
 const d=previewDashes(c.R,o.pos,long?260:180);
 toast(lieToast(o,c));flipCounter(o.strokes);
 await Promise.all([...rs,d,wait(long?600:200)])}
function lieToast(o,c){const left=c.R.last-o.pos;const there=o.state==='green'?'On the green.':`${left} to the cup.`;
 if(o.stuck)return 'Too hot. Lipped out, 1 peg closer.';
 if(o.bounce)return `Too hot. Lipped out, back ${c.R.last-o.landing}. ${there}`;
 if(o.state==='green')return 'On the green. Even sinks it.';
 return `Fairway. ${left} to the cup.`}
async function waterMoment(o,c){
 mark('water');cue('splash');const W=c.pt(o.landing),F=c.pt(o.from);
 await tween(180,e=>place(c.b,W.x,W.y,{s:1-.6*e,o:1-e}),inQuad);
 await Promise.all([ripple(W.x,W.y,380,{color:'#dce8ff',s1:2.4}),ripple(W.x,W.y,380,{color:'#dce8ff',s1:3.2,delay:110,op:.8}),ripple(W.x,W.y,380,{color:'#dce8ff',s1:4,delay:220,op:.6}),
  spray(W.x,W.y,500),shake(220),flipCounter(o.strokes,{blue:true,plus:2})]);
 await wait(300);
 // ghost ball drifts back along a blue dotted line to where the shot was hit from
 mark('water-back');cue('ghost-return');
 const line=sv('line',{x1:f2(W.x),y1:f2(W.y),x2:f2(F.x),y2:f2(F.y),stroke:'#8fb0ff','stroke-width':2.4,'stroke-dasharray':'2 5','stroke-linecap':'round','vector-effect':'non-scaling-stroke',opacity:0});
 await tween(150,e=>line.setAttribute('opacity',f2(e)));
 toast('Splash. +1 stroke, back to your lie.','water');
 await tween(600,e=>{const g=lerpP(W,F,e);place(c.b,g.x,g.y,{o:.5})},inOutSine);
 c.b.sand.setAttribute('opacity',o.state==='bunker'?'1':'0');
 await tween(150,e=>{place(c.b,F.x,F.y,{o:.5+.5*e});line.setAttribute('opacity',f2(1-e))});c.cur=o.from}
async function bunkerMoment(o,c){
 mark('bunker');const F=c.pt(o.landing);
 if(o.mv===0){cue('bunker-stuck');toast("Didn't get out.",'sand');await Promise.all([tween(160,(e,p)=>place(c.b,F.x,F.y,{sx:1+.12*Math.sin(Math.PI*p),sy:1-.1*Math.sin(Math.PI*p)})),puff(F.x,F.y,400),flipCounter(o.strokes)]);
  c.b.sand.setAttribute('opacity','1');return}
 cue('bunker-thud');
 await Promise.all([tween(120,(e,p)=>place(c.b,F.x,F.y,{sx:1.3-.3*p,sy:.7+.3*p})),puff(F.x,F.y,400),flipCounter(o.strokes),
  after(120,()=>tween(220,e=>c.b.sand.setAttribute('opacity',f2(e))))]);
 toast('In the bunker. Next roll is −1.','sand');await wait(200)}
async function scoreMoment(o,c){
 const ace=o.strokes===1,name=scoreShort(o.diff,o.strokes),C=c.pt(c.R.last);
 if(ace){mark('ace');cue('ace');
  await dropIn(c,{ace:true});
  const gc=c.h.gc,g=fit([{x:gc.x-80,y:gc.y-80},{x:gc.x+80,y:gc.y+80},{x:C.x,y:C.y-50}],30,CAM.rot);
  flash('#ffd66b',380);camTo(g,200,'cubic-bezier(.2,.8,.2,1)');
  const flag=cam.querySelector('#flag'+c.h.n);
  const wave=flag?tween(1600,(e,p)=>flag.setAttribute('transform',`rotate(${f2(7*Math.sin(p*Math.PI*6)*(1-.6*p))} ${f2(C.x)} ${f2(C.y)})`)).then(()=>flag.removeAttribute('transform')):null;
  const rings=[0,180,360].map(d=>ripple(C.x,C.y,700,{color:'#ffd66b',s0:.6,s1:5,w:3,delay:d}));
  const conf=confetti(C,1600);
  const b=banner('HOLE IN ONE','ribbon');await popIn(b,420,.3);
  await wait(1800);fadeOutLater(b,0);await Promise.all([...rings,conf,wave]);return}
 if(o.diff<=-1){mark('birdie');cue('birdie');
  await curlIn(c);
  const ringP=ripple(C.x,C.y,400,{color:'#ffd66b',s0:.6,s1:3.4,w:2.5});
  const b=banner(`${name.toUpperCase()} · ${o.strokes}`,'pill');const pop=popIn(b,260);
  const mc=miniCard(o),cell=mc.querySelector('.cell');mc.style.opacity='0';await tween(120,e=>mc.style.opacity=f2(e));
  // the red handwritten score flies from the cup to the card, then gets circled like on paper
  const lr=layer.getBoundingClientRect(),cr=cell.getBoundingClientRect(),from=toScreen(C),to={x:cr.left-lr.left+cr.width/2,y:cr.top-lr.top+cr.height/2};
  const fly=el('scorefly',layer,String(o.strokes));
  await tween(330,(e,p)=>{const x=lerp(from.x,to.x,e),y=lerp(from.y,to.y,e)-Math.sin(Math.PI*e)*40;fly.style.transform=`translate(${f2(x)}px,${f2(y)}px) translate(-50%,-50%) scale(${f2(1.7-.7*e)})`;fly.style.opacity=f2(Math.min(1,p*4))},inOutSine);
  fly.remove();cell.textContent=o.strokes;
  const rings=o.diff<=-2?2:1;cell.insertAdjacentHTML('beforeend',`<svg viewBox="0 0 40 30" aria-hidden="true">${Array.from({length:rings},(_,i)=>`<ellipse cx="20" cy="15" rx="${16+i*3.5}" ry="${11+i*3}" pathLength="100" transform="rotate(-8 20 15)"/>`).join('')}</svg>`);
  const es=[...cell.querySelectorAll('ellipse')];cue('pencil-circle');
  await tween(240,e=>es.forEach((q,i)=>q.style.strokeDashoffset=f2(100-100*Math.min(1,Math.max(0,e*rings-i)))));
  await Promise.all([pop,ringP]);fadeOutLater(b,900*spd());fadeOutLater(mc,1500*spd());return}
 await dropIn(c);
 if(o.diff===0){mark('par');cue('par');const b=banner(`PAR · ${o.strokes}`,'pill');await popIn(b,260);await wait(400);fadeOutLater(b,300*spd());return}
 mark('over');cue('bogey');toast(`${name}. In for ${o.strokes}.`)}

/* ---- the sequences ---- */
async function playShot(o,c){
 if(o.kind==='putt'){const t=await dicePhase(o,'putt');const sl=t.slide();
  mark('putt');cue('putt');const F=c.pt(o.from),C=c.pt(c.R.last);
  if(o.holed){await tween(360,e=>{const g=lerpP(F,C,e*.9);place(c.b,g.x,g.y)},inQuad);await sl;c.cur=c.R.last;flipCounter(o.strokes);await scoreMoment(o,c);return}
  await tween(220,e=>{const g=lerpP(F,C,.8*e);place(c.b,g.x,g.y)},outQuad);
  const L={x:c.b.x,y:c.b.y},a0=Math.atan2(L.y-C.y,L.x-C.x),r=Math.max(5,Math.hypot(L.x-C.x,L.y-C.y));
  await tween(130,e=>{const a=a0+e*Math.PI*.9;place(c.b,C.x+Math.cos(a)*r,C.y+Math.sin(a)*r)});
  const M={x:c.b.x,y:c.b.y};toast('Odd. Lipped out, +1 stroke.');flipCounter(o.strokes);
  await tween(200,e=>{const g=lerpP(M,F,e);place(c.b,g.x,g.y)},outCubic);await sl;return}
 const long=!!o.two,t=await dicePhase(o,long?'long':'short');let fl=null;
 if(long)fl=await launchAndFly(o,c,t);else{const sl=t.slide();await rollTo(o,c);await sl}
 await hops(o,c,long?180:120,long?70:50);
 if(chipEl)chipEl.style.opacity='0';
 if(o.bounce)await bounceBack(o,c);
 if(fl)fl.cleanup();
 if(o.hazard==='water')await waterMoment(o,c);
 else if(o.hazard==='bunker')await bunkerMoment(o,c);
 else if(o.holed){flipCounter(o.strokes);await scoreMoment(o,c)}
 else await landMoment(o,c,long);
 if(fl)await fl.trailP}
// Reduced motion: no travel, shake or confetti. Quick fades, and every piece of information still shown.
async function playReduced(o,c){mark('reduced');
 const D=Math.round(Math.max(38,Math.min(72,Math.min(VW,VH)*.14))),tray=el('tray');const bg=el('tray-bg',tray),n=o.dice.length,gap=D*1.24,cx=VW/2,cy=Math.round(TOPUI+(VH-TOPUI)*.5);
 bg.style.width=(n*gap+D*.55)+'px';bg.style.height=(D*1.62)+'px';bg.style.transform=`translate(${f2(cx-(n*gap+D*.55)/2)}px,${f2(cy-D*.93)}px)`;
 o.dice.forEach((v,k)=>{const d=dieNode(tray,D);d.face.innerHTML=dieFace(v);d.w.style.transform=`translate(${f2(cx+(k-(n-1)/2)*gap-D/2)}px,${f2(cy-D/2)}px)`});if(o.penalty)moveTag(tagNode(tray),cx-(n-1)/2*gap,cy,D);
 const tot=el('ttotal',tray,o.kind==='putt'?`${o.raw} · ${o.raw%2===0?'Even':'Odd'}`:o.penalty?`${o.raw} − 1 = ${o.mv}`:n===2?`${o.dice[0]} + ${o.dice[1]} = ${o.mv}`:`${o.mv} ${o.mv===1?'peg':'pegs'}`);
 tot.style.transform=`translate(${f2(cx)}px,${f2(cy+D*.62)}px) translate(-50%,0)`;tot.style.fontSize=Math.round(Math.max(13,D*.27))+'px';
 [$('d1'),$('d2')].forEach((d,k)=>{if(d&&k<n){d.hidden=false;d.classList.remove('blank');d.innerHTML=dieFace(o.dice[k])}});
 tray.style.opacity='0';await tween(150,e=>tray.style.opacity=f2(e));await wait(450);await tween(150,e=>tray.style.opacity=f2(1-e));tray.remove();
 const end=o.hazard==='water'?o.landing:o.pos,E=c.pt(end),F=c.pt(o.from);
 await tween(150,e=>place(c.b,F.x,F.y,{o:1-e}));c.b.sand.setAttribute('opacity',o.state==='bunker'&&o.hazard!=='water'?'1':'0');
 if(o.holed){flipCounter(o.strokes);const name=scoreShort(o.diff,o.strokes);
  if(o.strokes===1){mark('ace');const b=banner('HOLE IN ONE','ribbon');await tween(200,e=>b.style.opacity=f2(e));await wait(1800);fadeOutLater(b,0)}
  else if(o.diff<=-1){mark('birdie');const b=banner(`${name.toUpperCase()} · ${o.strokes}`,'pill'),mc=miniCard(o),cell=mc.querySelector('.cell');cell.textContent=o.strokes;
   cell.insertAdjacentHTML('beforeend',`<svg viewBox="0 0 40 30" aria-hidden="true">${Array.from({length:o.diff<=-2?2:1},(_,i)=>`<ellipse cx="20" cy="15" rx="${16+i*3.5}" ry="${11+i*3}" pathLength="100" style="stroke-dashoffset:0" transform="rotate(-8 20 15)"/>`).join('')}</svg>`);
   mc.style.opacity='0';await tween(200,e=>{b.style.opacity=f2(e);mc.style.opacity=f2(e)});await wait(900);fadeOutLater(b,0);fadeOutLater(mc,600)}
  else if(o.diff===0){mark('par');const b=banner(`PAR · ${o.strokes}`,'pill');await tween(200,e=>b.style.opacity=f2(e));await wait(500);fadeOutLater(b,0)}
  else toast(`${name}. In for ${o.strokes}.`);return}
 await tween(150,e=>place(c.b,E.x,E.y,{o:e}));
 if(o.hazard==='water'){mark('water');flipCounter(o.strokes);toast('Splash. +1 stroke, back to your lie.','water');await wait(500);await tween(150,e=>place(c.b,E.x,E.y,{o:1-e}));await tween(150,e=>place(c.b,F.x,F.y,{o:e}));return}
 flipCounter(o.strokes);
 if(o.hazard==='bunker'){mark('bunker');toast(o.mv===0?"Didn't get out.":'In the bunker. Next roll is −1.','sand')}
 else if(o.kind==='putt')toast('Odd. Lipped out, +1 stroke.');
 else toast(lieToast(o,c));
 await wait(250)}

function clearLayer(){if(!layer)return;layer.querySelectorAll('.tray,.banner,.minicard,.scorefly,.flash,.confetti,.plustag').forEach(n=>n.remove());if(chipEl){chipEl.remove();chipEl=null}hideToast()}
async function play(o){
 fx=cam.querySelector('#fx');layer=$('fxl');if(!fx||!layer)return;
 S.busy=true;S.skipping=false;dts.length=0;lastEnd=-1e9;clearLayer();fx.innerHTML='';svg.style.transform='';
 const watchdog=setTimeout(skip,15000); // never let the UI stay locked
 let c=null;
 try{c=setup(o);await (reducedMotion()?playReduced(o,c):playShot(o,c))}catch(e){console.error(e)}
 clearTimeout(watchdog);
 for(const t of [...live]){step(t,1);fin(t)}
 fx.innerHTML='';svg.style.transform='';if(chipEl){chipEl.remove();chipEl=null}
 layer.querySelectorAll('.tray,.scorefly,.flash,.confetti').forEach(n=>n.remove());
 if(dts.length>40){const d=dts.slice().sort((a,b)=>a-b);if(d[d.length>>1]>30)S.lowPower=true}
 S.busy=false;S.skipping=false;mark('idle')}
return{play,skip,setFast,cue,get busy(){return S.busy},get phase(){return S.phase},get marks(){return marks.slice()},get fast(){return S.fast},get guardUntil(){return S.guardUntil},get lowPower(){return S.lowPower},set lowPower(v){S.lowPower=!!v}};
})();
