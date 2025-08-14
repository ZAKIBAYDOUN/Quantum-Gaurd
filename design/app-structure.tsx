import React from "react";

export function AppShell() {
  return (
    <div className="min-h-screen bg-quantum text-ink">
      {/* NAV */}
      <header className="q-nav">
        <div className="q-brand">
          <img src="icon.svg" alt="logo" className="q-logo" />
          <span className="q-title">Quantum Guard</span>
        </div>
        <nav className="q-actions">
          <a className="q-btn ghost" href="index.html">Inicio</a>
          <a className="q-btn ghost" href="studio.html">Studio</a>
          <button className="q-btn primary">Conectar</button>
        </nav>
      </header>

      {/* HERO */}
      <section className="q-hero">
        <h1 className="q-display">Seguridad Descentralizada. Quantum‑ready.</h1>
        <p className="q-muted">5470 mining • Taylor Pass • QNN/MPC • ZK • Multichain</p>
        <div className="q-cta">
          <a className="q-btn" href="#dashboard">Abrir módulos</a>
        </div>
      </section>

      {/* BANNER DE SEGURIDAD CUÁNTICA */}
      <section className="q-banner-sec">
        <div className="q-banner-content">
          <div className="q-dot q-dot1" />
          <div>
            <h3>Quantum Shield activo</h3>
            <p className="q-muted">Firmas endurecidas y verificación multiruta.</p>
          </div>
          <div className="q-badges">
            <span className="q-chip ok">PostQuantum Ready</span>
            <span className="q-chip">MPC</span>
            <span className="q-chip">ZK</span>
          </div>
        </div>
      </section>

      {/* MONITOR DE PUENTES CUÁNTICOS */}
      <section id="dashboard" className="q-grid">
        <article className="q-card glow">
          <h3>Puentes cuánticos</h3>
          <p className="q-muted">Latencia y estado de canales</p>
          <div className="q-monitor">
            <div className="q-bridge">
              <span className="q-dot pulse" />
              <span>Mainnet ↔ 5470</span>
              <span className="q-badge ok">34ms</span>
            </div>
            <div className="q-bridge">
              <span className="q-dot pulse warn" />
              <span>5470  Base</span>
              <span className="q-badge warn">~120ms</span>
            </div>
          </div>
        </article>

        <article className="q-card glow">
          <h3>Estados de conexión</h3>
          <p className="q-muted">Cartera y red</p>
          <div className="q-state">
            <div className="q-row">
              <span className="q-k">Wallet</span>
              <span className="q-v anim-conn">Desconectado</span>
            </div>
            <div className="q-row">
              <span className="q-k">Red</span>
              <span className="q-v">—</span>
            </div>
          </div>
        </article>

        <article className="q-card glow">
          <h3>Módulos</h3>
          <div className="q-mods">
            <button className="q-btn ghost">Mining 5470</button>
            <button className="q-btn ghost">Taylor Pass</button>
            <button className="q-btn ghost">QNeural Chat</button>
            <button className="q-btn ghost">MPC Wallet</button>
            <button className="q-btn ghost">DEX</button>
            <button className="q-btn ghost">ZK</button>
          </div>
        </article>
      </section>

      {/* FOOTER */}
      <footer className="q-foot">
        <span>v1  PWA  Offline</span>
      </footer>
    </div>
  );
}
