/* ---------------- DATA ---------------- */
// Course data. Pure, no DOM. Loaded first.
// par, yards, handicap, dogleg bend (sign = which side the hole turns; the inside of the turn is the corner-cutting side)
const HOLES=[
 [4,420,12,40],[4,400,7,-55],[3,180,11,30],[5,540,2,-75],[4,420,15,55],[4,420,9,-45],[5,560,4,80],[3,220,16,-30],[4,400,13,45],
 [4,440,5,-65],[4,440,14,50],[3,200,17,-25],[5,580,3,75],[4,400,6,-45],[4,400,8,40],[3,190,18,-30],[4,430,10,55],[5,600,1,-80]
].map(([par,yds,hcp,bend],i)=>{const n=i+1;
 // Four routes per hole, chosen fresh on every tee. Tuned by simulation (40k plays each):
 //   Safe       longest, nothing to hit            par 4: mean 4.37, under par 35%, triple+ 11%
 //   Steady     one peg shorter, one pond          par 4: mean 4.34, under par 40%, triple+ 13%
 //   Aggressive two shorter, two ponds + a bunker  par 4: mean 4.27, under par 44%, triple+ 14%
 //   Hero       cuts the corner, three ponds       par 4: mean 4.57, under par 44%, triple+ 19%
 // Each route = its own branch pegs (c) joining the shared fairway at trunk peg j (bigger j = corner cut). Water = +1 stroke and back to where you shot from.
 const greenLen=par===3?2:3;
 const T=par===3?3:par===4?5:7; // trunk pegs (fairway + green)
 const d=par===3?(yds>=220?1:0):par===4?(yds>=440?1:0):(yds<=540?-1:yds>=600?1:0); // hole length tweak
 const tiers=par===3?[[4,0,{}],[4,1,{2:'b',3:'b'}],[4,1,{2:'w'}],[3,1,{1:'w'}]]
            :par===4?[[8+d,0,{}],[8+d,1,{5:'w'}],[7+d,1,{4:'w',5:'w',6:'b'}],[7+d,2,{4:'w',5:'w',6:'w'}]]
            :[[11+d,0,{}],[11+d,1,{5:'w'}],[11+d,2,{4:'w',5:'w',6:'b'}],[11+d,3,{4:'w',5:'w',6:'w'}]];
 // lane assignment: hero on the inside of the dogleg, safe on the outside
 const laneTier=bend>0?[0,1,2,3]:[3,2,1,0]; // lane L,LR,RL,R -> tier index
 return{n,par,yds,hcp,bend,greenLen,T,tiers,laneTier,pegs:tiers[0][0]+T}});
const TIER_NAMES=['Safe','Steady','Aggressive','Hero'];
const TIER_BLURB=['Longest path, nothing to hit.','One peg shorter, one pond on the way.','Two pegs shorter, two ponds and a bunker.','Cuts the corner. Three ponds. Big swings.'];
const route=(h,lane)=>h.routes[lane];
const COLORS={red:'#d23b2a',yellow:'#f2c231',green:'#2f9a3f',white:'#f6f2e8',blue:'#3b5ed8'};
const TEES=['L','LR','RL','R'];
const LANE_OFF=[-39,-13,13,39];
const PAR_TOTAL=72;
