/* ---------------- ENGINE ---------------- */
// Rules and game state. No DOM, no timers. shoot() updates G (and saves) immediately and returns a plain outcome
// object describing what happened; the ui/anim layers own all timing and only ever read that object.
let G=null;
const SAVE='cuhgolf.round.v2';
function save(){try{localStorage.setItem(SAVE,JSON.stringify(G))}catch(e){}}
function load(){try{return JSON.parse(localStorage.getItem(SAVE))}catch(e){return null}}
function curPlayer(){return G.order[G.turn]}
function curH(){return HOLES[G.hole%18]}
const isPlayoff=()=>G.hole>=18;
const totalOf=i=>G.scores[i].slice(0,18).reduce((a,b)=>a+(b||0),0);
function nextStep(){ // after a finished hole: 'next' | 'playoff' (tied list) | 'final' (winner)
 if(G.hole<17)return{type:'next'};
 const act=G.active;const val=i=>G.hole===17?totalOf(i):G.scores[i][G.hole];
 const best=Math.min(...act.map(val));const lead=act.filter(i=>val(i)===best);
 return lead.length===1?{type:'final',winner:lead[0]}:{type:'playoff',tied:lead}}
function newGame(players){
 G={players,hole:0,scores:players.map(()=>Array(18).fill(null)),lie:[],order:[],turn:0,phase:'play',log:[],busy:false,lastRoll:null};
 startHole();G.phase='start';save();
}
function startHole(){if(!G.active)G.active=G.players.map((_,i)=>i);
 G.lie=G.players.map((_,i)=>G.active.includes(i)?{pos:0,strokes:0,state:'tee',lane:null}:{pos:0,strokes:0,state:'out',lane:null});
 if(G.hole===0)G.order=G.active.slice();
 else{const prev=G.hole-1;G.order=G.active.slice().sort((a,b)=>G.scores[a][prev]-G.scores[b][prev]||G.order.indexOf(a)-G.order.indexOf(b))}
 G.turn=0;G.phase='play';G.lastRoll=null;
 G.log=[isPlayoff()?`Playoff hole ${G.hole+1} (plays as hole ${curH().n}). ${G.order.map(i=>G.players[i].name).join(' vs ')}. Low score wins.`:`Hole ${G.hole+1}. ${G.players[G.order[0]].name} has the honors.`];save()}
function advanceTurn(){const n=G.order.length;for(let i=1;i<=n;i++){const t=(G.turn+i)%n;if(G.lie[G.order[t]].state!=='holed'){G.turn=t;return true}}return false}

// Test hook: values pushed here are used as the next dice before Math.random (see CUH.rig in main.js). Empty in normal play.
const RIG=[];
function rollDie(){return RIG.length?RIG.shift():1+Math.floor(Math.random()*6)}

// The whole shot rule set, as a pure function. lie = {pos,state}; R = route; dice = rolled values.
// Returns everything needed to draw the shot: path of pegs, carry peg + hops (cosmetic split of the same path), bounce, hazard, result.
function resolveShot(lie,R,par,dice){
 const from=lie.pos,st=lie.state,last=R.last;
 if(st==='green'){const d=dice[0],even=d%2===0;
  return{kind:'putt',dice,raw:d,mv:0,penalty:0,from,carry:from,hops:[],forward:[],back:[],path:[],bounce:false,stuck:false,
   landing:even?last:from,hazard:null,holed:even,strokesAdded:1,pos:even?last:from,state:even?'holed':'green',fromState:st}}
 const raw=dice[0]+(dice[1]||0);const penalty=st==='bunker'?1:0;const mv=penalty?Math.max(0,raw-1):raw;
 let target=from+mv,bounce=false,stuck=false;
 if(target>last){target=last-(target-last);bounce=true;if(target<=from){target=Math.min(from+1,last);stuck=true}}
 const holed=target===last&&!stuck;
 let state,pos=target,hazard=null,strokesAdded=1;
 if(holed)state='holed';
 else if(target>=R.greenStart)state='green';
 else if(R.haz[target]==='w'){hazard='water';strokesAdded=2;pos=from;state=from===0?'tee':(R.haz[from]==='b'?'bunker':'fairway')}
 else if(R.haz[target]==='b'){hazard='bunker';state='bunker'}
 else state='fairway';
 // pegs travelled: forward to the cup at most, then bounced back
 const forward=[];for(let k=from+1;k<=Math.min(from+mv,last);k++)forward.push(k);
 const back=[];if(bounce)for(let k=last-1;k>=target;k--)back.push(k);
 // carry/hops split (presentation only): the last 1-2 forward pegs are hops. A ball that ends in sand or water plugs
 // (no hops), and the first landing is never on a hazard peg; hops pass over hazards and only the final peg counts.
 let nh=forward.length>=3?2:forward.length===2?1:0;
 if(!bounce&&hazard)nh=0;
 while(nh>0&&R.haz[forward[forward.length-1-nh]])nh--;
 const ci=forward.length-1-nh;
 return{kind:'shot',dice,raw,mv,penalty,from,carry:ci>=0?forward[ci]:from,hops:forward.slice(ci+1),forward,back,path:forward.concat(back),
  bounce,stuck,landing:target,hazard,holed,strokesAdded,pos,state,fromState:st}}

// Play the current player's shot. Mutates G, saves, and returns the outcome (or null if no shot is allowed).
function shoot(){
 if(!G||G.phase!=='play')return null;const pi=curPlayer(),L=G.lie[pi],h=curH(),pl=G.players[pi];if(L.lane==null)return null;const R=route(h,L.lane);
 const putt=L.state==='green',two=L.state==='tee'&&h.par>3;
 const dice=putt?[rollDie()]:two?[rollDie(),rollDie()]:[rollDie()];
 const before={pos:L.pos,state:L.state,strokes:L.strokes};
 const o=resolveShot(L,R,h.par,dice);
 G.lastRoll=dice;L.strokes+=o.strokesAdded;L.pos=o.pos;L.state=o.state;
 if(o.holed)G.scores[pi][G.hole]=L.strokes;
 let msg;
 if(putt)msg=o.holed?`<b>${pl.name}</b> rolled ${o.raw}. Even. In the cup for ${L.strokes}, ${scoreName(L.strokes-h.par,L.strokes)}.`:`<b>${pl.name}</b> rolled ${o.raw}. Odd. Putt lips out, +1 stroke. Roll again.`;
 else{const rollTxt=two?`${dice[0]} + ${dice[1]} = ${o.raw}`:`${o.raw}`;const pre=o.penalty?' Bunker, so −1.':'';
  if(o.holed)msg=`<b>${pl.name}</b> rolled ${rollTxt}.${pre}${o.bounce?' Bounced back':' Rolled'} right into the cup! Holed for ${L.strokes}, ${scoreName(L.strokes-h.par,L.strokes)}.`;
  else if(o.state==='green')msg=`<b>${pl.name}</b> rolled ${rollTxt}.${pre}${o.bounce?' Overshot the cup and bounced back.':''} On the green, now putt.`;
  else if(o.hazard==='water')msg=`<b>${pl.name}</b> rolled ${rollTxt}.${pre} Splash. +1 stroke and back to where you shot from.`;
  else if(o.hazard==='bunker')msg=`<b>${pl.name}</b> rolled ${rollTxt}.${pre} ${o.mv===0?'Didn\'t get out of the bunker.':'Into the bunker.'} Next roll is −1.`;
  else msg=`<b>${pl.name}</b> rolled ${rollTxt}.${pre}${o.stuck?' Overshot the cup, bounce stops 1 peg ahead.':o.bounce?' Overshot the cup and bounced back to the fairway.':' Fairway.'}`}
 G.log.unshift(msg);G.log=G.log.slice(0,3);
 let holeDone=false;
 if(L.state==='holed'||L.state!=='green'){const more=advanceTurn();if(!more){G.phase='holeDone';holeDone=true}}
 save();
 return{...o,pi,hole:G.hole,holeN:h.n,par:h.par,lane:L.lane,two,before,strokes:L.strokes,diff:L.strokes-h.par,holeDone,msg};
}
// Tee box choice for the current player. Returns true if it was taken.
function pickLane(lane){if(!G||G.phase!=='play')return false;const L=G.lie[curPlayer()];if(L.lane!=null)return false;L.lane=+lane;const h=curH();
 G.log.unshift(`<b>${G.players[curPlayer()].name}</b> takes the ${TIER_NAMES[h.routes[L.lane].tier]} route.`);G.log=G.log.slice(0,3);save();return true}
// After the round-start or hole-complete card: 'play' | 'final' | 'next'
function advanceAfterCard(){if(G.phase==='start'){G.phase='play';save();return 'play'}const ns=nextStep();
 if(ns.type==='final'){G.winner=ns.winner;G.phase='final';save();return 'final'}if(ns.type==='playoff')G.active=ns.tied;G.hole++;startHole();return 'next'}
function scoreName(d,st){if(st===1)return 'a hole in one';return d<=-3?'an albatross':d===-2?'an eagle':d===-1?'a birdie':d===0?'par':d===1?'a bogey':d===2?'a double bogey':d===3?'a triple bogey':`+${d}`}
function scoreShort(d,st){if(st===1)return 'Hole in one';return d<=-3?'Albatross':d===-2?'Eagle':d===-1?'Birdie':d===0?'Par':d===1?'Bogey':d===2?'Double':d===3?'Triple':`+${d}`}

// Monte Carlo of the real engine (resolveShot) for the tee-choice odds. Dice are drawn in the same order as live play.
function simHole(h,R){const L={pos:0,state:'tee'};let strokes=0;const d=()=>1+Math.floor(Math.random()*6);
 while(true){const dice=L.state==='green'?[d()]:(L.state==='tee'&&h.par>3)?[d(),d()]:[d()];
  const o=resolveShot(L,R,h.par,dice);strokes+=o.strokesAdded;if(o.holed)return strokes;L.pos=o.pos;L.state=o.state}}
function computeOdds(N=1500){for(const h of HOLES)for(const R of h.routes){let u=0,o=0,s=0;for(let i=0;i<N;i++){const v=simHole(h,R);s+=v;if(v<h.par)u++;else if(v>=h.par+2)o++}R.odds={under:Math.round(100*u/N),blow:Math.round(100*o/N),mean:(s/N).toFixed(1)}}}
computeOdds();
