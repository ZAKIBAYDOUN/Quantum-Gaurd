(function(){
  function getInputs(){
    const n = document.getElementById('mining-nonce').value; const nonce = n? BigInt(n): 0n;
    const prev = document.getElementById('mining-prevhash').value.trim();
    const sigs = document.getElementById('mining-sigs').value.trim() || '0x';
    return { nonce, prevHash: prev || '0x' + '00'.repeat(32), signatures: sigs };
  }
  async function getSigner(){ if(!window.ethers||!window.provider) throw new Error('Conecta wallet'); return (await new ethers.BrowserProvider(window.provider).getSigner()); }
  function getContract(name){ const c = window.currentContracts||window.contracts||{}; return c[name]; }
  async function getCa(name){ const ci = getContract(name); if (!ci) throw new Error('Contrato no configurado: '+name); const abi = await (await fetch(ci.abi)).json(); const signer = await getSigner(); return new ethers.Contract(ci.address, abi, signer); }
  async function params(){ try{ const ca = await getCa('Token5470Mining'); const p = await ca.getMiningParams(); document.getElementById('mining-output').textContent = `difficulty=${p[0]} height=${p[1]} reward=${p[2]} target=${p[3]}s`; }catch(e){ alert(e.message||e); } }
  async function stats(){ try{ const ca = await getCa('Token5470Mining'); const me = window.currentAccount; const s = await ca.getMinerStats(me); document.getElementById('mining-output').textContent = `blocks=${s[0]} rewards=${s[1]} last=${s[2]} active=${s[3]}`; }catch(e){ alert(e.message||e); } }
  async function register(){ try{ const ca = await getCa('Token5470Mining'); const me = window.currentAccount; const q = await (window.QNN?.qnnValidate?.(me)); const score = q?.score ? BigInt(Math.floor(Number(q.score)*1e6)) : 0n; const { signatures } = getInputs(); const tx = await ca.registerMiner(score, signatures); document.getElementById('mining-output').textContent = `registerMiner tx: ${tx.hash}`; }catch(e){ alert(e.message||e); } }
  async function submit(){ try{ const ca = await getCa('Token5470Mining'); const { nonce, prevHash, signatures } = getInputs(); const t = BigInt(Math.floor(Date.now()/1000)); const q = await (window.QNN?.qnnValidate?.(window.currentAccount)); const score = q?.score ? BigInt(Math.floor(Number(q.score)*1e6)) : 0n; const tx = await ca.submitWork(nonce, t, prevHash, score, signatures); document.getElementById('mining-output').textContent = `submitWork tx: ${tx.hash}`; }catch(e){ alert(e.message||e); } }
  function init(){
    const by = (id)=>document.getElementById(id);
    by('btn-mining-params')?.addEventListener('click', params);
    by('btn-mining-stats')?.addEventListener('click', stats);
    by('btn-mining-register')?.addEventListener('click', register);
    by('btn-mining-submit')?.addEventListener('click', submit);
    by('btn-mining-claim')?.addEventListener('click', async()=>{ try{ const ca=await getCa('Token5470Mining'); const tx=await ca.claim(); document.getElementById('mining-output').textContent = `claim tx: ${tx.hash}`; }catch(e){ alert(e.message||e); } });
  }
  window.Mining5470 = { init };
})();
