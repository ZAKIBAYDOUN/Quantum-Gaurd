(function(){
  async function ask(){
    const input = document.getElementById('chat-input');
    const q = input.value.trim(); if (!q) return;
    const out = document.getElementById('chat-output');
    out.textContent = 'Thinking…';
    try{
      const res = await window.Neurons32.handleQuestion(q);
      out.textContent = JSON.stringify(res, null, 2);
    }catch(e){ out.textContent = 'Error: ' + (e?.message||e); }
  }
  function init(){ const btn = document.getElementById('chat-ask'); if (btn) btn.onclick = ()=> ask(); const inp=document.getElementById('chat-input'); if (inp) inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ ask(); }}); }
  document.addEventListener('DOMContentLoaded', init);
  window.NeuralChat = { ask };
})();
