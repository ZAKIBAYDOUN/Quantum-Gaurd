(function(){
  const KEY = 'theme-5470';
  function apply(t){ const root = document.documentElement; if (t==='light'){ root.classList.add('theme-light'); } else { root.classList.remove('theme-light'); } localStorage.setItem(KEY, t||'dark'); }
  function init(){ const saved = localStorage.getItem(KEY)||'dark'; apply(saved); const btn = document.getElementById('btn-theme'); if (btn) btn.onclick = ()=> apply(document.documentElement.classList.contains('theme-light')? 'dark':'light'); }
  document.addEventListener('DOMContentLoaded', init);
  window.Theme5470 = { apply };
})();
