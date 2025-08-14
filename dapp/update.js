(function(){
  const el = document.createElement('div');
  el.id = 'update-banner';
  el.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;background:#10182a;color:#cfe0ff;border:1px solid #172036;border-radius:10px;padding:12px 14px;display:none;z-index:9999;';
  el.innerHTML = '<strong>Actualización disponible</strong> <span id="updVer" class="mono"></span> · <a id="updLink" href="#" style="color:#4da3ff">Descargar</a>';
  document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(el));

  async function check() {
    try {
      const v = (window.HOST && window.HOST.version) || '0.0.0';
      const api = 'https://api.github.com/repos/ZAKIBAYDOUN/Quantum-Gaurd/releases/latest';
      const r = await fetch(api, { headers: { 'Accept': 'application/vnd.github+json' } });
      const j = await r.json();
      const tag = (j && j.tag_name) || '';
      if (!tag) return;
      const newer = tag.replace(/^v/, '') !== v;
      if (!newer) return;
      const isWin = navigator.userAgent.includes('Windows');
      const isLinux = navigator.userAgent.includes('Linux');
      let asset = null;
      for (const a of (j.assets||[])) {
        if (isWin && a.name.endsWith('.exe')) { asset = a; break; }
        if (isLinux && (a.name.endsWith('.AppImage') || a.name.endsWith('.deb'))) { asset = a; }
      }
      if (asset) {
        document.getElementById('updVer').textContent = 'v'+tag.replace(/^v/,'');
        const link = document.getElementById('updLink');
        link.href = asset.browser_download_url;
        el.style.display = 'block';
      }
    } catch {}
  }
  setTimeout(check, 3000);
})();
