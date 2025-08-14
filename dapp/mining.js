(function(){
  function getInputs(){
    const n = document.getElementById('mining-nonce')?.value; const nonce = n? BigInt(n): 0n;
    const prev = document.getElementById('mining-prevhash')?.value?.trim();
    const sigs = document.getElementById('mining-sigs')?.value?.trim() || '0x';
    return { nonce, prevHash: prev || '0x' + '00'.repeat(32), signatures: sigs };
  }
  async function getSigner(){ if(!window.ethers||!window.provider) throw new Error('Conecta wallet'); return (await new ethers.BrowserProvider(window.provider).getSigner()); }
  function getContract(name){ const c = window.currentContracts||window.contracts||{}; return c[name]; }
  async function getCa(name){ const ci = getContract(name); if (!ci) throw new Error('Contrato no configurado: '+name); const abi = await (await fetch(ci.abi)).json(); const signer = await getSigner(); return { ca: new ethers.Contract(ci.address, abi, signer), abi }; }
  function hasFn(abi, name){ try{ return (abi||[]).some(x=>x?.type==='function' && x.name===name); }catch(e){ return false; } }
  async function params(){
    try{
      const { ca, abi } = await getCa('Token5470Mining');
      let out;
      if (hasFn(abi,'getMiningParams')) out = await ca.getMiningParams();
      else if (hasFn(abi,'miningParams')) out = await ca.miningParams();
      else if (hasFn(abi,'getParams')) out = await ca.getParams();
      else return alert('La ABI no expone parámetros de minería');
      document.getElementById('mining-output').textContent = `difficulty=${out[0]} height=${out[1]} reward=${out[2]} target=${out[3]}s`;
    }catch(e){ alert(e.message||e); }
  }
  async function stats(){
    try{
      const { ca, abi } = await getCa('Token5470Mining');
      const me = window.currentAccount;
      let s;
      if (hasFn(abi,'getMinerStats')) s = await ca.getMinerStats(me);
      else if (hasFn(abi,'minerStats')) s = await ca.minerStats(me);
      else if (hasFn(abi,'getStats')) s = await ca.getStats(me);
      else return alert('La ABI no expone estadísticas de minero');
      document.getElementById('mining-output').textContent = `blocks=${s[0]} rewards=${s[1]} last=${s[2]} active=${s[3]}`;
    }catch(e){ alert(e.message||e); }
  }
  async function register(){
    try{
      const { ca, abi } = await getCa('Token5470Mining');
      const me = window.currentAccount;
      const q = await (window.QNN?.qnnValidate?.(me));
      const score = q?.score ? BigInt(Math.floor(Number(q.score)*1e6)) : 0n;
      const { signatures } = getInputs();
      let tx;
      if (hasFn(abi,'registerMiner')) tx = await ca.registerMiner(score, signatures);
      else if (hasFn(abi,'register')) tx = await ca.register(score, signatures);
      else return alert('La ABI no expone registro de minero');
      document.getElementById('mining-output').textContent = `register tx: ${tx.hash}`;
    }catch(e){ alert(e.message||e); }
  }
  async function submit(){
    try{
      const { ca, abi } = await getCa('Token5470Mining');
      const { nonce, prevHash, signatures } = getInputs();
      const t = BigInt(Math.floor(Date.now()/1000));
      const q = await (window.QNN?.qnnValidate?.(window.currentAccount));
      const score = q?.score ? BigInt(Math.floor(Number(q.score)*1e6)) : 0n;
      let tx;
      if (hasFn(abi,'submitWork')) {
        try { tx = await ca.submitWork(nonce, t, prevHash, score, signatures); }
        catch { try { tx = await ca.submitWork(nonce, prevHash, signatures); } catch {}}
      }
      if (!tx && hasFn(abi,'submit')) {
        try { tx = await ca.submit(nonce, t, prevHash, score, signatures); } catch {}
      }
      if (!tx && hasFn(abi,'mine')) {
        try { tx = await ca.mine(); } catch {}
      }
      if (!tx) return alert('La ABI no expone submit/mine compatibles');
      document.getElementById('mining-output').textContent = `submit tx: ${tx.hash}`;
    }catch(e){ alert(e.message||e); }
  }
  async function claim(){
    try{
      const { ca, abi } = await getCa('Token5470Mining');
      if (hasFn(abi,'claim')) { const tx = await ca.claim(); document.getElementById('mining-output').textContent = `claim tx: ${tx.hash}`; }
      else alert('La ABI no expone claim');
    }catch(e){ alert(e.message||e); }
  }
  function init(){
    const by=(id)=>document.getElementById(id);
    by('btn-mining-params')?.addEventListener('click', params);
    by('btn-mining-stats')?.addEventListener('click', stats);
    by('btn-mining-register')?.addEventListener('click', register);
    by('btn-mining-submit')?.addEventListener('click', submit);
    by('btn-mining-claim')?.addEventListener('click', claim);
  }
  window.Mining5470 = { init };
})();
