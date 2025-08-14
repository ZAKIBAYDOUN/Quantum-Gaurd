export function detectCosmos() {
  const hasKeplr = typeof window.keplr !== 'undefined';
  const el = document.getElementById('cosmosStatus');
  if (el) el.textContent = hasKeplr ? 'Cosmos wallet: Keplr detected' : 'Cosmos wallet: not detected';
}

export function detectDag() {
  const hasStargazer = typeof window.stargazer !== 'undefined' || typeof window.Constellation !== 'undefined' || typeof window.constellation !== 'undefined';
  const el = document.getElementById('dagStatus');
  if (el) el.textContent = hasStargazer ? 'DAG wallet: detected' : 'DAG wallet: not detected';
}

window.addEventListener('load', () => { detectCosmos(); detectDag(); });
