(function(){
  const state = { mining:false, interval:null };
  function getSigner() { if (!window.ethers || !window.provider) throw new Error('Wallet no conectada'); return new ethers.BrowserProvider(window.provider).getSigner(); }
  async function findMiningContract() {
    // Busca contrato "Token5470" o "Neurons" en mapping dinámico si existe
    const cid = window.currentChainIdHex || (window.chainId && '0x'+Number(window.chainId).toString(16));
    if (!cid) return null;
    const pathA = `dapp/contracts.${parseInt(window.chainId||0) }.json`;
    try {
      const contracts = window.currentContracts || window.contracts || {};
      const candidates = ['Token5470','Neurons','Mining','Miner'];
      for (const name of candidates) {
        if (contracts[name]) { return { name, info: contracts[name] }; }
      }
    } catch(e) {}
    return null;
  }
  async function start() {
    const signer = await getSigner();
    const c = await findMiningContract();
    if (!c) throw new Error('Contrato de minería no configurado');
    const abi = await (await fetch(c.info.abi)).json();
    const ca = new ethers.Contract(c.info.address, abi, await signer);
    state.mining = true;
    const out = document.getElementById('mining-output');
    out.textContent = 'Minando';
    // Placeholder: intenta llamar a funciones conocidas si existen
    const tryTick = async ()=>{
      if (!state.mining) return;
      try {
        if (ca.mine) {
          const tx = await ca.mine();
          out.textContent = `mine() enviado: ${tx.hash}`;
        } else if (ca.submitWork) {
          const nonce = Math.floor(Math.random()*1e9);
          const tx = await ca.submitWork(nonce);
          out.textContent = `submitWork(${nonce}) enviado: ${tx.hash}`;
        } else if (ca.claim) {
          const tx = await ca.claim();
          out.textContent = `claim() enviado: ${tx.hash}`;
        } else {
          out.textContent = 'No se reconoce interfaz de minería. Configura ABI/dirección.';
          stop();
        }
      } catch(err){ out.textContent = 'Error: '+(err?.message||err); }
    };
    await tryTick();
  }
  function stop(){ state.mining=false; if (state.interval){ clearInterval(state.interval); state.interval=null; } document.getElementById('mining-output').textContent = 'Parado.'; }
  async function claim(){
    const signer = await getSigner();
    const c = await findMiningContract();
    if (!c) throw new Error('Contrato no configurado');
    const abi = await (await fetch(c.info.abi)).json();
    const ca = new ethers.Contract(c.info.address, abi, await signer);
    if (ca.claim) { const tx = await ca.claim(); document.getElementById('mining-output').textContent = `claim() enviado: ${tx.hash}`; }
    else document.getElementById('mining-output').textContent = 'claim() no disponible en ABI.';
  }
  function init(){
    const bStart = document.getElementById('btn-mining-start');
    const bStop = document.getElementById('btn-mining-stop');
    const bClaim = document.getElementById('btn-mining-claim');
    if (bStart) bStart.onclick = ()=> start().catch(e=> alert(e.message||e));
    if (bStop) bStop.onclick = ()=> stop();
    if (bClaim) bClaim.onclick = ()=> claim().catch(e=> alert(e.message||e));
  }
  window.Mining5470 = { init, start, stop, claim };
})();
