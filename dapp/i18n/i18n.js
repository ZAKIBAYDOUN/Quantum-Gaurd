(function(){
  const LANG_KEY = 'lang-5470';
  let dict = {};
  function t(key){ return dict[key] || key; }
  async function load(lang){
    const base = await fetch('./i18n/en.json').then(r=>r.json());
    let extra = {};
    try { extra = await fetch(`./i18n/${lang}.json`, { cache:'no-store' }).then(r=> r.ok? r.json(): {}); } catch {}
    dict = Object.assign({}, base, extra);
    document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if (k && dict[k]) el.textContent = dict[k]; });
    const ph = {
      'deploy-abi':'deploy.abi', 'deploy-bytecode':'deploy.bytecode', 'deploy-args':'deploy.args'
    };
    Object.entries(ph).forEach(([id,key])=>{ const el=document.getElementById(id); if(el&&dict[key]) el.setAttribute('placeholder', dict[key]); });
    localStorage.setItem(LANG_KEY, lang);
    // Tagline render
    const tg = document.getElementById('tagline'); if (tg) tg.textContent = t('app.tagline');
  }
  async function init(){
    // Populate selector
    const sel = document.getElementById('langSelect');
    try{
      const langs = await fetch('./i18n/languages.json').then(r=>r.json());
      langs.forEach(l=>{ const o=document.createElement('option'); o.value=l.code; o.textContent = `${l.name}  ${l.native}`; sel?.appendChild(o); });
    }catch{}
    const saved = localStorage.getItem(LANG_KEY) || 'en';
    if (sel) { sel.value = saved; sel.onchange = ()=> load(sel.value); }
    await load(saved);
  }
  document.addEventListener('DOMContentLoaded', init);
  window.i18n = { t, load };
})();
