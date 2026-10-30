/* ---------------- BOOT ---------------- */
window.claude?.hot?.snapshot?.(()=>({G}));
function start(data){if(data&&data.G){G=data.G;G.busy=false;enterPlay()}else showTitle()}
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});
// Test hooks (used by test/run.mjs). CUH.rig(6,6) makes the next dice roll 6 and 6. Unused in normal play.
window.CUH={rig:(...v)=>{RIG.push(...v.flat())},get anim(){return Anim},get G(){return G}};
