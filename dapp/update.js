(function(){
  const el = document.createElement('div');
  el.id = 'update-banner';
  el.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;background:#10182a;color:#cfe0ff;border:1px solid #172036;border-radius:10px;padding:12px 14px;display:none;z-index:9999;';

  const hasNative = !!(window.HOST && window.HOST.update);
  if (hasNative) {
    el.innerHTML = '<strong>Actualización</strong> · <span id="updMsg">Buscando</span> <span id="updPct" class="mono" style="margin-left:8px"></span>';
    document.addEventListener('DOMContentLoaded',()=>{ document.body.appendChild(el); el.style.display='block'; });

    const off = window.HOST.update.on((m)=>{
      const msgEl = document.getElementById('updMsg');
      const pctEl = document.getElementById('updPct');
      if (!msgEl) return;
      switch(m && m.status){
        case 'checking': msgEl.textContent='Buscando actualización'; pctEl.textContent=''; break;
        case 'available': msgEl.textContent='Descargando actualización'; break;
        case 'downloading': msgEl.textContent='Descargando'; pctEl.textContent = (m.percent? Math.round(m.percent):0)+'%'; break;
        case 'downloaded': msgEl.textContent='Instalando y reiniciando'; pctEl.textContent='100%'; break;
        case 'none': el.style.display='none'; off && off(); break;
        case 'error': msgEl.textContent = 'Error: ' + (m.message || 'desconocido'); break;
      }
    });
    // trigger check shortly after load
    setTimeout(()=>{ try { window.HOST.update.check(); } catch {} }, 1500);
    return; // native path ends here
  }

    // Fallback (web/PWA): solo invitar a instalar la app de escritorio
  el.innerHTML = '<strong>Nueva versión</strong> · Instala la app de escritorio para auto-actualizarse <a id="updLink" href="#" style="color:#4da3ff">Descargar QuantumGuard-Setup.exe</a>';
  document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(el));
  const link = () => 'https://github.com/ZAKIBAYDOUN/Quantum-Gaurd/releases/latest/download/QuantumGuard-Setup.exe';
  document.addEventListener('DOMContentLoaded',()=>{ const a = document.getElementById('updLink'); if(a) a.href = link(); el.style.display = 'block'; });
})();