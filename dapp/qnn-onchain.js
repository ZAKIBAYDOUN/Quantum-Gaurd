(function(){
  async function qnnValidate(addr){
    try{
      if (!window.ethers || !window.provider) throw new Error('Wallet no conectada');
      const provider = new ethers.BrowserProvider(window.provider);
      const signer = await provider.getSigner();
      const contracts = window.currentContracts || window.contracts || {};
      const q = contracts.QNNOracle;
      if (!q) return { score: 0.5, decision: false };
      const abi = await (await fetch(q.abi)).json();
      const ca = new ethers.Contract(q.address, abi, signer);
      const me = addr || window.currentAccount;
      const scoreBN = await ca.qnnValidate(me);
      const score = Number(scoreBN) / 1e6; // si tu oráculo devuelve enteros escalados, ajusta aquí
      const decision = score >= 0.6;
      return { score, decision };
    }catch(e){ return { score: 0.5, decision: false } }
  }
  window.QNN = window.QNN || {};
  window.QNN.qnnValidate = qnnValidate;
})();
