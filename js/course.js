/* ---------------- COURSE GEOMETRY ---------------- */
// Perimeter loop, per-hole layout, route odds (via the real engine) and the static SVG. No DOM.
const CW=1100,CH=2900,X0=160,X1=940,Y0=160,Y1=2740,R=220,MID=(X0+X1)/2;
const segs=[];
function addLine(ax,ay,bx,by){const L=Math.hypot(bx-ax,by-ay);segs.push({L,f:u=>({x:ax+(bx-ax)*u,y:ay+(by-ay)*u,tx:(bx-ax)/L,ty:(by-ay)/L})})}
function addArc(cx,cy,a0,a1){const L=R*(a1-a0);segs.push({L,f:u=>{const a=a0+(a1-a0)*u;return{x:cx+R*Math.cos(a),y:cy+R*Math.sin(a),tx:-Math.sin(a),ty:Math.cos(a)}}})}
addLine(MID,Y1,X0+R,Y1);addArc(X0+R,Y1-R,Math.PI/2,Math.PI);addLine(X0,Y1-R,X0,Y0+R);addArc(X0+R,Y0+R,Math.PI,1.5*Math.PI);
addLine(X0+R,Y0,X1-R,Y0);addArc(X1-R,Y0+R,1.5*Math.PI,2*Math.PI);addLine(X1,Y0+R,X1,Y1-R);addArc(X1-R,Y1-R,0,Math.PI/2);addLine(X1-R,Y1,MID,Y1);
const PERIM=segs.reduce((a,s)=>a+s.L,0);
function P(t){t=((t%PERIM)+PERIM)%PERIM;for(const s of segs){if(t<=s.L){const q=s.f(t/s.L);return{...q,nx:-q.ty,ny:q.tx}}t-=s.L}const q=segs[0].f(0);return{...q,nx:-q.ty,ny:q.tx}}
const SEGS=HOLES.reduce((a,h)=>a+h.pegs-1,0);const GAP=120,SP=(PERIM-18*GAP)/SEGS;
(function layout(){let t=0;for(const h of HOLES){const N=h.pegs,len=(N-1)*SP,bd=Math.sign(h.bend)*Math.min(Math.abs(h.bend),len*.26);
 const cl=tt=>{const u=tt/(N-1),q=P(t+tt*SP);const off=bd*Math.sin(Math.PI*u)+bd*.25*Math.sin(2*Math.PI*u);return{x:q.x+q.nx*off,y:q.y+q.ny*off,nx:q.nx,ny:q.ny,tx:q.tx,ty:q.ty}};
 const lat=(p,o)=>({...p,x:p.x+p.nx*o,y:p.y+p.ny*o});
 h.pts=[];for(let k=0;k<N;k++)h.pts.push(cl(k));
 const cSafe=h.tiers[0][0];const trunk=Array.from({length:h.T},(_,i)=>cl(cSafe+i));
 // a branch of c pegs from the lane's tee peg to trunk peg j, bowed toward its own side until the pegs sit ~SP apart
 const branch=(side,o0,c,j)=>{const end=cSafe+j;
  const pt=(u,A)=>lat(cl(u*end),o0*(1-u)+side*A*Math.sin(Math.PI*u));
  const arc=A=>{let L=0,prev=pt(0,A);for(let i=1;i<=80;i++){const q=pt(i/80,A);L+=Math.hypot(q.x-prev.x,q.y-prev.y);prev=q}return L};
  let A=0;if(arc(0)<c*SP){let lo=0,hi=360;for(let i=0;i<30;i++){const mid=(lo+hi)/2;(arc(mid)<c*SP?lo=mid:hi=mid)}A=(lo+hi)/2}
  const L=arc(A);const out=[];let acc=0,prev=pt(0,A);out.push(prev);
  for(let i=1;i<=800&&out.length<c;i++){const q=pt(i/800,A);acc+=Math.hypot(q.x-prev.x,q.y-prev.y);prev=q;if(acc>=out.length*L/c)out.push(q)}
  while(out.length<c)out.push(prev);return out};
 h.routes=TEES.map((_,lane)=>{const side=lane<2?-1:1,tier=h.laneTier[lane];const [c,j,hz]=h.tiers[tier];
  const b=branch(side,LANE_OFF[lane],c,j);const pts=b.concat(trunk.slice(j));
  const r={tier,lane,pts,last:pts.length-1,greenStart:pts.length-h.greenLen,bLen:c,haz:{...hz},join:j};return r});
 const t0=h.pts[0];h.tl={x:t0.x-t0.nx*100,y:t0.y-t0.ny*100};h.cup=trunk[trunk.length-1];
 const g=trunk.slice(h.T-h.greenLen);h.gc={x:g.reduce((a,p)=>a+p.x,0)/g.length,y:g.reduce((a,p)=>a+p.y,0)/g.length};t+=(N-1)*SP+GAP}})();

let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};

function buildCourse(){
 const o=[];const f=n=>n.toFixed(1);
 o.push(`<rect x="0" y="0" width="${CW}" height="${CH}" fill="#f3efc9"/>`);
 // trees ring
 const allPts=HOLES.flatMap(h=>h.routes.flatMap(r=>r.pts));const nearHole=(x,y)=>allPts.some(p=>(p.x-x)**2+(p.y-y)**2<110*110)||HOLES.some(h=>(h.tl.x-x)**2+(h.tl.y-y)**2<70*70);
 for(let i=0;i<360;i++){const t=i*PERIM/360,q=P(t);const side=i%2?1:-1;const d=120+rnd()*50;const x=q.x+q.nx*side*d,y=q.y+q.ny*side*d;if(rnd()<.35||nearHole(x,y))continue;
  for(let k=0;k<3;k++){const r=9+rnd()*7;o.push(`<circle cx="${f(x+(rnd()-.5)*22)}" cy="${f(y+(rnd()-.5)*22)}" r="${f(r)}" fill="#2a7a3a" stroke="#1d5a2a" stroke-width="1"/>`)}}
 for(const h of HOLES){
  const lanes=h.routes.map(r=>r.pts.slice(0,r.greenStart+1).map(p=>`${f(p.x)},${f(p.y)}`).join(' '));
  for(const fw of lanes)o.push(`<polyline points="${fw}" fill="none" stroke="#3d9a40" stroke-width="96" stroke-linecap="round" stroke-linejoin="round"/>`);
  for(const fw of lanes)o.push(`<polyline points="${fw}" fill="none" stroke="#72bf4e" stroke-width="66" stroke-linecap="round" stroke-linejoin="round"/>`);
  const hz=[],seen=new Set();h.routes.forEach((r,k)=>{for(const i in r.haz){const p=r.pts[i];if(!seen.has(p)){seen.add(p);hz.push([p,r.haz[i],+i<r.bLen?(k<2?-1:1):0])}}});
  for(const [p,t,side] of hz){const ang=Math.atan2(p.ty,p.tx)*180/Math.PI;
   if(t==='w'){const o2=side?side*9:14,rx=side?22:34,ry=side?16:26;const cx=p.x+p.nx*o2,cy=p.y+p.ny*o2;o.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${rx}" ry="${ry}" transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})" fill="#3b5ed8" stroke="#2a46a8" stroke-width="2"/>`)}
   else{const o2=side?side*8:-10;const cx=p.x+p.nx*o2,cy=p.y+p.ny*o2;o.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${side?18:22}" ry="${side?13:15}" transform="rotate(${f(ang+20)} ${f(cx)} ${f(cy)})" fill="#f0cb8f" stroke="#c9a060" stroke-width="1.5"/>`)}}
  // green
  o.push(`<circle cx="${f(h.gc.x)}" cy="${f(h.gc.y)}" r="58" fill="#56b04a"/><circle cx="${f(h.gc.x)}" cy="${f(h.gc.y)}" r="48" fill="#2e8540" stroke="#1f6a30" stroke-width="2"/>`);
  // tee box: 3 pegs
  const t0=h.pts[0];const ang=Math.atan2(t0.ty,t0.tx)*180/Math.PI;
  o.push(`<rect x="${f(t0.x-14)}" y="${f(t0.y-56)}" width="28" height="112" rx="10" transform="rotate(${f(ang)} ${f(t0.x)} ${f(t0.y)})" fill="#8fd16a" stroke="#4e9a3a" stroke-width="1.5"/>`);
  h.routes.forEach(r=>o.push(`<polyline points="${r.pts.map(p=>`${f(p.x)},${f(p.y)}`).join(' ')}" fill="none" stroke="#2d2a1a" stroke-width=".9" opacity=".7"/>`));
  const drawn=new Set();h.routes.forEach((r,k)=>r.pts.forEach((p,i)=>{if(drawn.has(p))return;drawn.add(p);
   if(i===0)o.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="4" fill="#3b2a14" stroke="#e9d9a6" stroke-width="1.2"/><text x="${f(p.x-p.tx*11)}" y="${f(p.y-p.ty*11+2)}" font-family="Archivo,sans-serif" font-size="5.5" font-weight="700" fill="#1b3a1c" text-anchor="middle">${TIER_NAMES[r.tier][0]}</text>`);
   else if(p===h.cup)o.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="5.5" fill="#111" stroke="#fff" stroke-width="1.5"/>`);
   else o.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="3.5" fill="#3b2a14"/>`)}));
  // flag + numbers (counter-rotated labels)
  const cup=h.cup;
  o.push(`<g class="lbl" data-h="${h.n}" data-x="${f(cup.x)}" data-y="${f(cup.y)}"><g class="flag" id="flag${h.n}"><line x1="${f(cup.x)}" y1="${f(cup.y)}" x2="${f(cup.x)}" y2="${f(cup.y-40)}" stroke="#222" stroke-width="2"/><polygon points="${f(cup.x)},${f(cup.y-40)} ${f(cup.x+30)},${f(cup.y-31)} ${f(cup.x)},${f(cup.y-22)}" fill="#d23b2a"/></g><text x="${f(cup.x+8)}" y="${f(cup.y-28)}" font-family="Archivo Black,Impact,sans-serif" font-size="11" fill="#fff">${h.n}</text></g>`);
  const tl=h.tl;
  o.push(`<g class="lbl" data-h="${h.n}" data-x="${f(tl.x)}" data-y="${f(tl.y)}"><rect x="${f(tl.x-19)}" y="${f(tl.y-19)}" width="38" height="38" rx="6" fill="#7bc45a" stroke="#2f6a2a" stroke-width="1.5"/><text x="${f(tl.x)}" y="${f(tl.y+8)}" text-anchor="middle" font-family="Archivo Black,Impact,sans-serif" font-size="22" fill="#143a18">${h.n}</text><text x="${f(tl.x)}" y="${f(tl.y+32)}" text-anchor="middle" font-family="Archivo,sans-serif" font-size="9" font-weight="700" fill="#143a18">par ${h.par} · ${h.hcp} H</text></g>`);
 }
 // clubhouse
 const cx=MID,cy=Y1-520;
 o.push(`<g class="lbl" data-x="${cx}" data-y="${cy}"><polygon points="${cx-60},${cy-10} ${cx},${cy-60} ${cx+60},${cy-10}" fill="#7a2a1e"/><rect x="${cx-52}" y="${cy-10}" width="104" height="60" fill="#8b3a2a" stroke="#4a1d14" stroke-width="2"/><rect x="${cx-40}" y="${cy+2}" width="22" height="22" fill="#f3efc9"/><rect x="${cx+18}" y="${cy+2}" width="22" height="22" fill="#f3efc9"/><rect x="${cx-10}" y="${cy+16}" width="20" height="34" fill="#4a1d14"/><rect x="${cx-70}" y="${cy+58}" width="140" height="34" fill="#7a2a1e"/><text x="${cx}" y="${cy+72}" text-anchor="middle" font-family="Archivo Black,Impact,sans-serif" font-size="11" fill="#f3efc9">PAR 72</text><text x="${cx}" y="${cy+85}" text-anchor="middle" font-family="Archivo,sans-serif" font-size="9" font-weight="700" fill="#f3efc9">7,240 yds · CLUBHOUSE</text><g id="rack"></g></g>`);
 o.push(`<g class="lbl" data-x="${cx}" data-y="${CH/2}"><text x="${cx}" y="${CH/2}" text-anchor="middle" font-family="Archivo Black,Impact,sans-serif" font-size="30" fill="#17483a">CUH GOLF</text><text x="${cx}" y="${CH/2+20}" text-anchor="middle" font-family="Archivo,sans-serif" font-size="11" fill="#17483a">Championship Course</text></g>`);
 o.push(`<g id="balls"></g><g id="fx"></g>`);
 return o.join('');
}
