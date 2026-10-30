#!/usr/bin/env node
// Full-game parity: plays seeded rounds (random tee choices, 2-4 players, playoffs included) through the ORIGINAL
// single-file game logic at a git ref and through the new js/engine.js, feeding both the same dice and comparing
// the whole game state G after every action.
//   node tools/parity.js [--ref 5e2f922] [--rounds 300]
const fs=require('fs'),vm=require('vm'),path=require('path'),{execSync}=require('child_process');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d};
const root=path.join(__dirname,'..'),ref=arg('--ref','5e2f922'),ROUNDS=+arg('--rounds',300);
const mkRand=s=>()=>{s=(s*48271)%2147483647;return s/2147483647};
// Math.random that serves queued dice first (v -> a random value that rolls exactly v), else a seeded stream
function ctrlMath(seed){const q=[],fb=mkRand(seed),M=Object.create(Math);M.random=()=>q.length?(q.shift()-.5)/6:fb();return{M,q}}
const stubDom=()=>{const el=new Proxy(function(){},{get:(t,k)=>k==='style'||k==='dataset'?{}:k==='classList'?{toggle(){},add(){},remove(){}}:k==='querySelectorAll'?()=>[]:k==='querySelector'?()=>null:typeof k==='string'?el:undefined,set:()=>true,apply:()=>el});
 return{getElementById:()=>el,querySelector:()=>el,querySelectorAll:()=>[]}};
const OLD_SRC=execSync(`git show ${ref}:index.html`,{cwd:root}).toString();
const NEW_SRC=['data.js','course.js','engine.js'].map(f=>fs.readFileSync(path.join(root,'js',f),'utf8')).join('\n;\n');
function oldEngine(M){const a=OLD_SRC.indexOf('/* ---------------- DATA'),b=OLD_SRC.indexOf('/* ---------------- RENDER: PLAY');
 const ctx={Math:M,console,document:stubDom(),ResizeObserver:class{observe(){}},requestAnimationFrame:()=>0,setTimeout:f=>f(),localStorage:{getItem(){return null},setItem(){}}};
 vm.createContext(ctx);vm.runInContext(OLD_SRC.slice(a,b)+`
  function renderDice(){};function renderPanel(){};function renderBalls(){};function showHoleResult(){};
  this.api={get G(){return G},newGame,shoot,curPlayer,curH,
   // the original tee-pick click handler and Next button handler, minus the DOM
   pick(l){if(G.busy||G.phase!=='play')return;const L=G.lie[curPlayer()];if(L.lane!=null)return;L.lane=l;const h=curH();G.log.unshift('<b>'+G.players[curPlayer()].name+'</b> takes the '+TIER_NAMES[h.routes[L.lane].tier]+' route.');G.log=G.log.slice(0,3);save()},
   next(){if(G.phase==='start'){G.phase='play';save();return 'play'}const ns=nextStep();if(ns.type==='final'){G.winner=ns.winner;G.phase='final';save();return 'final'}if(ns.type==='playoff')G.active=ns.tied;G.hole++;startHole();return 'next'}};`,ctx);return ctx.api}
function newEngine(M){const ctx={Math:M,console,localStorage:{getItem(){return null},setItem(){}}};vm.createContext(ctx);
 vm.runInContext(NEW_SRC+`\n;this.api={get G(){return G},newGame,shoot,curPlayer,curH,pick:pickLane,next:advanceAfterCard}`,ctx);return ctx.api}
const strip=G=>{const g=JSON.parse(JSON.stringify(G));delete g.busy;return JSON.stringify(g)};
let actions=0,shots=0,playoffHoles=0,aces=0,water=0,bunker=0,bounce=0,stuck=0;
for(let r=0;r<ROUNDS;r++){
 const A=ctrlMath(11+r),B=ctrlMath(11+r);const oldA=oldEngine(A.M),newA=newEngine(B.M);
 const choose=mkRand(1000+r),dice=mkRand(5000+r*7);
 const nP=2+Math.floor(choose()*3);const players=Array.from({length:nP},(_,i)=>({name:'P'+i,color:['red','yellow','green','blue'][i]}));
 oldA.newGame(players.map(p=>({...p})));newA.newGame(players.map(p=>({...p})));
 const check=w=>{actions++;const a=strip(oldA.G),b=strip(newA.G);if(a!==b){console.error('MISMATCH round',r,'after',w);console.error('old',a);console.error('new',b);process.exit(1)}};
 check('newGame');let guard=0;
 while(oldA.G.phase!=='final'&&guard++<6000){const G=oldA.G;
  if(G.phase==='start'||G.phase==='holeDone'){const a=oldA.next(),b=newA.next();if(a!==b){console.error('next differs',a,b);process.exit(1)}if(a==='next'&&oldA.G.hole>=18)playoffHoles++;check('next');continue}
  const L=G.lie[oldA.curPlayer()];
  if(L.lane==null){const lane=Math.floor(choose()*4);oldA.pick(lane);newA.pick(lane);check('pick');continue}
  const need=L.state==='green'?1:(L.state==='tee'&&oldA.curH().par>3)?2:1;
  const d=Array.from({length:need},()=>1+Math.floor(dice()*6));A.q.push(...d);B.q.push(...d);
  oldA.shoot();const o=newA.shoot();shots++;
  if(A.q.length||B.q.length){console.error('dice not consumed',A.q,B.q);process.exit(1)}
  if(o.holed&&o.strokes===1)aces++;if(o.hazard==='water')water++;if(o.hazard==='bunker')bunker++;if(o.bounce)bounce++;if(o.stuck)stuck++;
  // outcome object sanity: path/carry/hops agree with the result
  const end=o.path.length?o.path[o.path.length-1]:o.from;if(o.kind==='shot'&&end!==o.landing){console.error('path end != landing',o);process.exit(1)}
  if(o.kind==='shot'&&o.forward.length&&o.hops.length&&o.forward[o.forward.length-1-o.hops.length]!==o.carry){console.error('carry/hops mismatch',o);process.exit(1)}
  check('shoot')}
 if(guard>=6000){console.error('runaway round',r);process.exit(1)}}
console.log(`parity OK vs ${ref}: ${ROUNDS} rounds, ${shots} shots, ${actions} state checks identical`);
console.log(`  covered: ${playoffHoles} playoff holes, ${aces} aces, ${water} water, ${bunker} bunker, ${bounce} bounces (${stuck} stopped 1 peg ahead)`);
