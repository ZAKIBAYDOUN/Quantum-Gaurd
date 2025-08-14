(function(){
  async function health(){
    const checks = [];
    try { const nets = await fetch('./networks.json').then(r=>r.json()); const n = nets.find(x=>x.chainId===5470); checks.push({ id:'networks.5470', ok: !!n }); } catch { checks.push({ id:'networks.5470', ok:false }); }
    try { const map = await fetch('./contracts.json').then(r=>r.json()); checks.push({ id:'contracts.map', ok: !!map.contracts && Object.keys(map.contracts).length>=1 }); } catch { checks.push({ id:'contracts.map', ok:false }); }
    try { const p = new ethers.BrowserProvider(window.provider); await p.getBlockNumber(); checks.push({ id:'rpc.connect', ok:true }); } catch { checks.push({ id:'rpc.connect', ok:false }); }
    try { const res = await window.Neurons32.snapshot(); checks.push({ id:'neurons.snapshot', ok: !!res }); } catch { checks.push({ id:'neurons.snapshot', ok:false }); }
    const el = document.getElementById('tech-health'); el.textContent = JSON.stringify(checks, null, 2);
  }
  async function info(){
    const data = await window.Neurons32.snapshot();
    const el = document.getElementById('tech-info'); el.textContent = JSON.stringify(data, null, 2);
  }
  function init(){ document.getElementById('btn-tech-health')?.addEventListener('click', health); document.getElementById('btn-tech-info')?.addEventListener('click', info); }
  document.addEventListener('DOMContentLoaded', init);
  window.Tech = { health, info };
})();
