#!/usr/bin/env node
// Balance sim: seeded Monte Carlo of the real engine, N plays per route.
//   node tools/sim.js                 current js/ engine
//   node tools/sim.js --ref <git-ref> the original single-file engine at that ref (e.g. 5e2f922)
//   add --n 20000 --seed 20261029 --out file.json --compare other.json
const fs=require('fs'),vm=require('vm'),path=require('path'),{execSync}=require('child_process');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d};
const root=path.join(__dirname,'..');const N=+arg('--n',20000),SEED=+arg('--seed',20261029),ref=arg('--ref',null);
let seed=SEED;const M=Object.create(Math);M.random=()=>{seed=(seed*48271)%2147483647;return seed/2147483647};
const ctx={Math:M,console,localStorage:{getItem(){return null},setItem(){}}};vm.createContext(ctx);
if(ref){const src=execSync(`git show ${ref}:index.html`,{cwd:root}).toString();
 const a=src.indexOf('/* ---------------- DATA'),b=src.indexOf('for(const h of HOLES)for(const R of h.routes){const N=1500');
 vm.runInContext(src.slice(a,b)+'\n;this.HOLES=HOLES;this.simHole=simHole;',ctx)}
else{for(const f of ['data.js','course.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),ctx,{filename:f});
 vm.runInContext('this.HOLES=HOLES;this.simHole=simHole;',ctx)}
seed=SEED; // engine.js fills the tee odds at load; reset so both engines see the same random stream
const rows=[];for(const h of ctx.HOLES)for(const R of h.routes){let u=0,o=0,s=0;for(let i=0;i<N;i++){const v=ctx.simHole(h,R);s+=v;if(v<h.par)u++;else if(v>=h.par+2)o++}
 rows.push({hole:h.n,par:h.par,tier:R.tier,pegs:R.last,mean:+(s/N).toFixed(4),under:+(100*u/N).toFixed(2),blow:+(100*o/N).toFixed(2)})}
const names=['Safe','Steady','Aggressive','Hero'];
console.log(`${ref?'ref '+ref:'current js/'}  N=${N}/route  seed=${SEED}`);
for(const par of [3,4,5]){const line=names.map((nm,t)=>{const r=rows.filter(x=>x.par===par&&x.tier===t);const m=k=>(r.reduce((a,x)=>a+x[k],0)/r.length);return `${nm} ${m('mean').toFixed(3)} (u${m('under').toFixed(1)}% d+${m('blow').toFixed(1)}%)`});console.log(`par ${par}: `+line.join('  '))}
const out=arg('--out',null);if(out)fs.writeFileSync(out,JSON.stringify(rows,null,1));
const cmp=arg('--compare',null);if(cmp){const old=JSON.parse(fs.readFileSync(cmp,'utf8'));let diff=0;
 rows.forEach((r,i)=>{for(const k of ['mean','under','blow'])diff=Math.max(diff,Math.abs(r[k]-old[i][k]))});
 console.log(`compare vs ${path.basename(cmp)}: ${rows.length} routes, max abs difference ${diff} ${diff===0?'(identical)':''}`)}
