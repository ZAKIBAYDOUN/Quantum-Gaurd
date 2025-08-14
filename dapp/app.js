import { toHex, formatEth } from "./utils.js";
import { getProvider, initTabs, loadNetworks, populateNetworkSelect, ensureChain, loadConfig } from "./wallets.js";
import { batchNeuronCounts } from "./multicall.js";
import { verifyProofPlaceholder } from "./zk.js";
import { startMpcFlow } from "./mpc.js";
import { minOut } from "./dex.js";

const $ = (id) => document.getElementById(id);
const connectBtn = $("connectBtn");
const disconnectBtn = $("disconnectBtn");
const statusEl = $("status");
const chainEl = $("chain");
const accountEl = $("account");
const balanceEl = $("balance");
const networkSelect = $("networkSelect");

let currentAccount = null;
let networks = [];

function provider() { return getProvider(); }

async function connect() {
  const eth = provider();
  if (!eth) { statusEl.textContent = "No hay proveedor Web3. Instala MetaMask."; window.open("https://metamask.io/download/", "_blank"); return; }
  try {
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    currentAccount = accounts?.[0] || null;
    eth.on?.("accountsChanged", (a)=>{ currentAccount = a?.[0]||null; refresh(); });
    eth.on?.("chainChanged", ()=> refresh());
    connectBtn.style.display = "none"; disconnectBtn.style.display = "";
    await refresh();
  } catch { statusEl.textContent = "Conexión cancelada"; }
}
function disconnect() { currentAccount=null; accountEl.textContent=balanceEl.textContent="-"; statusEl.textContent="No conectado"; connectBtn.style.display=""; disconnectBtn.style.display="none"; }

async function getChainId() { const eth = provider(); if (!eth) return null; return await eth.request({ method: "eth_chainId" }); }
async function getBalance(addr) { const eth = provider(); if (!eth||!addr) return null; return await eth.request({ method: "eth_getBalance", params: [addr, "latest"] }); }

async function refresh() {
  const eth = provider(); if (!eth) return;
  const chainIdHex = await getChainId();
  if (chainIdHex) chainEl.textContent = `chainId ${parseInt(chainIdHex,16)} (${chainIdHex})`;
  if (currentAccount) {
    accountEl.textContent = currentAccount; const bal = await getBalance(currentAccount); balanceEl.textContent = formatEth(bal) + " ETH"; statusEl.textContent = "Conectado";
  } else { statusEl.textContent = "No conectado"; }
}

async function init() {
  initTabs();
  const cfg = await loadConfig();\n  networks = await loadNetworks();\n  populateNetworkSelect(networks, cfg);\n  if (cfg?.defaultChain) { try { await ensureChain(cfg.defaultChain, networks); } catch {} }
  networkSelect.addEventListener('change', async ()=> { await ensureChain(networkSelect.value); await refresh(); });

  // Buttons wiring
  const btnBatch = document.getElementById('btnBatchNeurons');
  if (btnBatch) btnBatch.addEventListener('click', async ()=>{
    try {
      const cfg = await (await fetch('./contracts.json', { cache:'no-store' })).json();
      const chainIdHex = await getChainId();
      const res = await batchNeuronCounts(provider(), chainIdHex, cfg);
      document.getElementById('neurons').textContent = res.join(',');
    } catch (e) { console.warn(e); }
  });

  const btnZk = document.getElementById('btnZkVerify');
  if (btnZk) btnZk.addEventListener('click', async ()=>{
    const out = await verifyProofPlaceholder();
    const el = document.getElementById('zkResult');
    el.textContent = out.ok ? 'OK' : out.message;
  });

  const btnMpc = document.getElementById('btnMpcStart');
  if (btnMpc) btnMpc.addEventListener('click', ()=>{
    const { ok, url } = startMpcFlow();
    const el = document.getElementById('mpcStatus');
    el.textContent = ok ? `Cosigner URL: ${url}` : 'MPC error';
  });

  const btnDex = document.getElementById('btnDexQuote');
  if (btnDex) btnDex.addEventListener('click', ()=>{
    const amount = document.getElementById('dexAmount').value || '0';
    const slip = parseInt(document.getElementById('dexSlip').value || '50', 10);
    try { document.getElementById('dexOut').textContent = minOut(amount, slip).toString(); } catch { document.getElementById('dexOut').textContent = '0'; }
  });
}

connectBtn.addEventListener("click", connect);
disconnectBtn.addEventListener("click", disconnect);

init();


