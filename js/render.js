/* ---------------- RENDER ---------------- */
// Camera, play screen, balls, scorecard and overlays. Reads G, never changes game rules.
const $=id=>document.getElementById(id);
const svg=$('svg'),cam=$('cam'),stage=document.querySelector('.stage');

/* ---- CAMERA ---- */
let VW=400,VH=400,camMode='hole',curRot=0,CAM=null;
const reducedMotion=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
function sizeSvg(){const w=stage.clientWidth||400,h=stage.clientHeight||400;if(w===VW&&h===VH&&CAM)return;VW=w;VH=h;svg.setAttribute('viewBox',`0 0 ${VW} ${VH}`);
 if(typeof Anim!=='undefined'&&Anim.busy)Anim.skip();applyCamera(false)}
new ResizeObserver(sizeSvg).observe(stage);
const TOPUI=60; // camera buttons band
function fit(pts,pad,rot,top=TOPUI,kMax=Infinity){const a=rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const p of pts){const rx=p.x*c-p.y*s,ry=p.x*s+p.y*c;x0=Math.min(x0,rx);x1=Math.max(x1,rx);y0=Math.min(y0,ry);y1=Math.max(y1,ry)}
 const w=Math.max(1,x1-x0),h=Math.max(1,y1-y0);const k=Math.min((VW-2*pad)/w,(VH-top-2*pad)/h,kMax);
 return{k,tx:VW/2-k*(x0+x1)/2,ty:top+(VH-top)/2-k*(y0+y1)/2,rot}}
function holeRot(h){const th=Math.atan2(h.gc.y-h.pts[0].y,h.gc.x-h.pts[0].x)*180/Math.PI;let rot=-90-th;while(rot>180)rot-=360;while(rot<=-180)rot+=360;return rot}
function holePts(h){return h.routes.flatMap(r=>r.pts).concat([{x:h.gc.x+62,y:h.gc.y+62},{x:h.gc.x-62,y:h.gc.y-62},{x:h.pts[0].x-h.pts[0].tx*24,y:h.pts[0].y-h.pts[0].ty*24},{x:h.tl.x-h.pts[0].nx*22,y:h.tl.y-h.pts[0].ny*22}])}
// close-up on route point i (the 'ball' camera)
function ballCam(rt,i,h=curH()){const rot=holeRot(h);const hc=fit(holePts(h),40,rot);const win=fit(rt.slice(Math.max(0,i-5),Math.min(rt.length,i+6)),60,rot);
 const k=Math.min(Math.max(win.k,hc.k),Math.max(hc.k*2.2,1.6));const a=rot*Math.PI/180,bp=rt[i];const rx=bp.x*Math.cos(a)-bp.y*Math.sin(a),ry=bp.x*Math.sin(a)+bp.y*Math.cos(a);
 return{k,tx:VW/2-k*rx,ty:TOPUI+(VH-TOPUI)/2-k*ry,rot}}
function camView(mode=camMode,pi=curPlayer()){const h=curH();
 if(mode==='course')return fit([{x:0,y:0},{x:CW,y:CH}],8,0);
 if(mode==='ball'){const L=G.lie[pi],rt=L.lane==null?h.pts:h.routes[L.lane].pts;return ballCam(rt,L.pos,h)}
 return fit(holePts(h),Math.min(44,VW*.1),holeRot(h))}
function setCam(c,ms=900,ease='cubic-bezier(.3,.8,.3,1)'){CAM=c;if(reducedMotion())ms=0;
 cam.style.transition=ms>0?`transform ${Math.round(ms)}ms ${ease}`:'none';
 cam.style.transform=`translate(${c.tx}px,${c.ty}px) scale(${c.k}) rotate(${c.rot}deg)`;
 if(c.rot!==curRot){curRot=c.rot;cam.querySelectorAll('.lbl').forEach(el=>el.setAttribute('transform',`rotate(${-c.rot} ${el.dataset.x} ${el.dataset.y})`));cam.querySelectorAll('.sink').forEach(el=>el.setAttribute('transform',`rotate(${-c.rot})`))}}
function applyCamera(animate=true){if(!G)return;const h=curH();
 cam.querySelectorAll('.lbl[data-h]').forEach(el=>el.classList.toggle('dim',camMode!=='course'&&+el.dataset.h!==h.n));
 setCam(camView(),animate?900:0)}
// course point -> stage pixel, for HTML effects that track the course (uses the camera's target)
function toScreen(p,c=CAM){const a=c.rot*Math.PI/180;return{x:c.tx+c.k*(p.x*Math.cos(a)-p.y*Math.sin(a)),y:c.ty+c.k*(p.x*Math.sin(a)+p.y*Math.cos(a))}}

/* ---- RENDER: PLAY ---- */
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!==id)}
const FACES={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function dieFace(v){const on=FACES[v];return Array.from({length:9},(_,k)=>`<i style="opacity:${on.includes(k)?1:0}"></i>`).join('')}
function renderDice(shake){const r=G.lastRoll||[];const h=curH(),L=G.lie[curPlayer()];if(L.lane==null)return;const need=(L.state==='tee'&&h.par>3)?2:1;
 [$('d1'),$('d2')].forEach((d,i)=>{const v=r[i];d.hidden=v===undefined&&i>=need;d.classList.toggle('blank',v===undefined);
  const tag=i===0&&L.state==='bunker'?'<span class="dtag">−1</span>':'';
  if(v===undefined){d.innerHTML=tag;return}d.innerHTML=dieFace(v)+tag;if(shake){d.classList.remove('shake');void d.offsetWidth;d.classList.add('shake')}})}
function lieText(L,h,R,lane){if(lane==null)return 'Pick a tee box for this hole.';const dist=R.last-L.pos;switch(L.state){case 'tee':return `${TIER_NAMES[R.tier]} route, ${R.last} pegs. ${h.par>3?'Two dice, driver.':'Par 3, one die.'}`;case 'fairway':return `Fairway, ${dist} pegs to the cup.`;case 'bunker':return `In the bunker, ${dist} to the cup. Next roll −1.`;case 'water':return `Wet. +1 stroke taken, ${dist} to the cup.`;case 'green':return 'On the green. Even sinks it, odd costs a stroke.';case 'holed':return 'Holed out.'}}
function renderPanel(){const h=curH();$('t-hole').textContent=G.hole+1;$('t-par').textContent=`${isPlayoff()?'Playoff · ':''}Par ${h.par} · ${h.yds} yds`;$('t-hcp').textContent=isPlayoff()?`Plays as hole ${h.n} · sudden death`:`Handicap ${h.hcp} · dogleg ${h.bend>0?'right':'left'}`;
 const pi=curPlayer(),pl=G.players[pi],L=G.lie[pi],lane=L.lane,R=lane==null?null:route(h,lane);
 $('w-peg').style.setProperty('--c',COLORS[pl.color]);$('w-name').textContent=pl.name;$('w-strokes').textContent=L.strokes;$('w-lie').textContent=lieText(L,h,R,lane);
 const choosing=lane==null&&G.phase==='play';$('act').hidden=choosing;$('tee-pick').hidden=!choosing;
 if(choosing)$('tee-pick').innerHTML=TEES.map((t,k)=>{const r=h.routes[k];return `<button class="tier t${r.tier}" data-lane="${k}"><b>${TIER_NAMES[r.tier]}</b><span>${t} tee · ${r.last} pegs${Object.keys(r.haz).length?' · '+Object.values(r.haz).filter(v=>v==='w').length+' water'+(Object.values(r.haz).some(v=>v==='b')?' · sand':''):' · clean'}</span><em>under par ${r.odds.under}% · double+ ${r.odds.blow}%</em></button>`}).join('');
 const busy=typeof Anim!=='undefined'&&Anim.busy;
 const b=$('b-roll');b.textContent=L.state==='green'?'Putt':(L.state==='tee'&&h.par>3)?'Drive':'Roll';b.disabled=busy||G.phase!=='play';
 if(!busy&&!choosing)renderDice(false);
 $('log').innerHTML=G.log.join('<br>');
 $('others').innerHTML=G.players.map((p,i)=>{const l=G.lie[i];if(l.state==='out')return '';return `<span class="chip${l.state==='holed'?' done':''}" style="--c:${COLORS[p.color]}"><i></i>${p.name} · ${l.strokes}</span>`}).join('');
}
// a ball in a bunker sits half sunk with a sand ring (drawn in screen orientation, hence the counter-rotation)
const SINK=()=>`<g class="sink" transform="rotate(${-curRot})"><path d="M-8.6,0.6 A8.6,8.6 0 0 0 8.6,0.6 Z" fill="#f0cb8f"/><ellipse cy="1" rx="11" ry="4.2" fill="none" stroke="#c9a060" stroke-width="1.6"/></g>`;
function ballPt(i){const h=curH(),L=G.lie[i];return L.lane==null?h.pts[0]:h.routes[L.lane].pts[L.pos]}
function renderBalls(){const g=cam.querySelector('#balls');if(!g)return;
 g.innerHTML=G.players.map((p,i)=>{const L=G.lie[i];if(L.state==='out')return '';const pt=ballPt(i);let x=pt.x,y=pt.y;
  const same=G.lie.filter((l,j)=>j<i&&l.state!=='out'&&ballPt(j)===pt).length;
  if(same){x+=Math.cos(same*2.1)*7;y+=Math.sin(same*2.1)*7}
  return `<g class="ballg" data-i="${i}" style="transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px)"><circle r="7" fill="${COLORS[p.color]}" stroke="#1b1a17" stroke-width="1.5"/>${L.state==='bunker'?SINK():''}</g>`}).join('');
 const rack=cam.querySelector('#rack');const cx=MID,cy=Y1-520;rack.innerHTML=[0,1,2,3].map(i=>`<circle cx="${cx-45+i*30}" cy="${cy+105}" r="6" fill="${G.players[i]?COLORS[G.players[i].color]:'#3b2a14'}" stroke="#1b1a17" stroke-width="1.5"/>`).join('');
}
function enterPlay(){showScreen('s-play');if(!cam.querySelector('#balls'))cam.innerHTML=buildCourse();curRot=1e9;renderBalls();renderPanel();sizeSvg();applyCamera(false);
 if(G.phase==='holeDone')showHoleResult();if(G.phase==='start')showStartCard();if(G.phase==='final')showFinal()}

/* ---- OVERLAYS ---- */
function showHoleResult(){const h=curH();const ns=nextStep();$('oh-title').textContent=`${isPlayoff()?'Playoff hole':'Hole'} ${G.hole+1} complete · par ${h.par}`;
 $('oh-list').innerHTML=G.active.map(i=>{const p=G.players[i];const s=G.scores[i][G.hole];return `<div class="hr" style="--c:${COLORS[p.color]}"><i></i><b>${p.name}</b><span class="r">${scoreShort(s-h.par,s)}</span><span class="s">${s}</span></div>`}).join('');
 $('oh-table').innerHTML=cardHTML();$('b-next').textContent=ns.type==='final'?'Final Scorecard':ns.type==='playoff'?`Tie! Playoff hole ${G.hole+2}`:`Tee off hole ${G.hole+2}`;$('oh-list').hidden=false;$('o-hole').hidden=false}
function showStartCard(){$('oh-title').textContent='Round start · 18 holes, par 72';$('oh-list').hidden=true;$('oh-table').innerHTML=cardHTML();$('b-next').textContent='Tee off hole 1';$('o-hole').hidden=false}
function cardHTML(){const sum=(i,a,b)=>{let t=0,ok=true;for(let k=a;k<b;k++){if(G.scores[i][k]==null)ok=false;else t+=G.scores[i][k]}return ok?t:''};
 const dot=p=>`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:1.5px solid var(--ink);background:${COLORS[p.color]};margin-right:5px;vertical-align:-1px"></span>`;
 const cell=(i,h)=>{const s=G.scores[i][h.n-1];return `<td class="hw ${s==null?'':s<h.par?'u':s>h.par?'o':''}">${s??''}</td>`};
 const half=(hs,a,b,tots)=>{const head=`<tr><th>HOLE</th>${hs.map(h=>`<th>${h.n}</th>`).join('')}${tots.map(t=>`<th>${t[0]}</th>`).join('')}</tr>`;
  const r=(label,fn,tv)=>`<tr><td class="n">${label}</td>${hs.map(h=>`<td>${fn(h)}</td>`).join('')}${tv.map(v=>`<td class="tot">${v}</td>`).join('')}</tr>`;
  const yds=r('Yardage',h=>h.yds,tots.map(t=>t[1])).replace('<tr>','<tr class="yds">');const hcp=r('Handicap',h=>h.hcp,tots.map(()=>''));const par=r('Par',h=>h.par,tots.map(t=>t[2]));
  const ps=G.players.map((p,i)=>`<tr><td class="n">${dot(p)}${p.name}</td>${hs.map(h=>cell(i,h)).join('')}${tots.map(t=>`<td class="tot hw">${sum(i,t[3],t[4])}</td>`).join('')}</tr>`).join('');
  return `<table class="sc">${head}${yds}${hcp}${par}${ps}</table>`};
 const front=half(HOLES.slice(0,9),0,9,[['OUT',3560,36,0,9]]);
 const back=half(HOLES.slice(9),9,18,[['IN',3680,36,9,18],['TOT',7240,72,0,18]]);
 let po='';const n=Math.max(...G.scores.map(r=>r.length));if(n>18){const cols=Array.from({length:n-18},(_,k)=>18+k);
  po=`<table class="sc"><tr><th>PLAYOFF</th>${cols.map(k=>`<th>${k+1}</th>`).join('')}</tr><tr><td class="n">Par</td>${cols.map(k=>`<td>${HOLES[k%18].par}</td>`).join('')}</tr>${G.players.map((p,i)=>cols.some(k=>G.scores[i][k]!=null)?`<tr><td class="n">${dot(p)}${p.name}</td>${cols.map(k=>{const s=G.scores[i][k];const par=HOLES[k%18].par;return `<td class="hw ${s==null?'':s<par?'u':s>par?'o':''}">${s??'–'}</td>`}).join('')}</tr>`:'').join('')}</table>`}
 return `<div class="cardsplit">${front}${back}</div>${po}`}
function showFinal(){const w=G.winner??G.active[0];const t=totalOf(w);const d=t-PAR_TOTAL;
 $('of-win').textContent=`${G.players[w].name} wins with ${t} (${d>=0?'+':''}${d})${G.hole>=18?` in a playoff on hole ${G.hole+1}`:''}`;$('of-table').innerHTML=cardHTML();$('o-final').hidden=false}
function showTitle(){const s=load();document.querySelectorAll('.ov').forEach(o=>o.hidden=true);$('b-continue').hidden=!(s&&s.phase!=='final');showScreen('s-title')}
