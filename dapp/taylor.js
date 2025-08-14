(function(){
  async function score(address){
    try {
      if (window.QNN && window.QNN.qnnValidate) {
        const res = await window.QNN.qnnValidate(address||window.currentAccount);
        return res?.score ?? 0.5;
      }
    } catch(e){}
    return 0.5; // neutro
  }
  async function check(){
    const addr = window.currentAccount;
    const s = await score(addr);
    const el = document.getElementById('taylor-score');
    if (el) el.textContent = String(s);
    const pass = s >= 0.6; // umbral configurable
    const st = document.getElementById('taylor-status');
    if (st) st.textContent = pass ? 'OK' : 'Riesgo';
    return pass;
  }
  function gate(fn){
    return async (...args)=>{ const ok = await check(); if (!ok) throw new Error('Taylor Pass bloqueó la acción'); return fn(...args); };
  }
  function init(){ const btn = document.getElementById('btn-taylor-check'); if (btn) btn.onclick = ()=> check(); }
  window.TaylorPass = { init, score, check, gate };
})();
