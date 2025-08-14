(function(){
  function pick(abi, names){
    try{
      const fns = (abi||[]).filter(x=>x?.type==='function').map(x=>x.name);
      for (const n of names){ if (fns.includes(n)) return n; }
    }catch(e){}
    return null;
  }
  function normalizeScore(v){
    try{
      const n = typeof v === 'bigint' ? Number(v) : (v? Number(v): 0);
      if (!isFinite(n)) return 0.5;
      if (n > 1e9) return Math.min(1, n/1e12);    // ej. escala 1e12
      if (n > 1e6) return Math.min(1, n/1e6);     // escala 1e6
      if (n > 1000) return Math.min(1, n/1000);   // escala 1e3
      if (n > 1) return Math.min(1, n/100);       // porcentaje 0..100
      if (n >= 0) return n;                        // ya 0..1
    }catch(e){}
    return 0.5;
  }
  async function qnnValidate(addr){
    try{
      if (!window.ethers || !window.provider) throw new Error('Wallet no conectada');
      const provider = new ethers.BrowserProvider(window.provider);
      const signer = await provider.getSigner();
      const contracts = window.currentContracts || window.contracts || {};
      const q = contracts.QNNOracle;
      if (!q) return { score: 0.5, decision: false };
      const abi = await (await fetch(q.abi)).json();
      const method = pick(abi, ['qnnValidate','verifyScore','getScore','scoreOf','validate']);
      const ca = new ethers.Contract(q.address, abi, signer);
      const me = addr || window.currentAccount;
      let raw = 0n;
      if (method) raw = await ca[method](me);
      const score = normalizeScore(raw);
      const decision = score >= 0.6;
      return { score, decision, method };
    }catch(e){ return { score: 0.5, decision: false } }
  }
  window.QNN = window.QNN || {};
  window.QNN.qnnValidate = qnnValidate;
})();
