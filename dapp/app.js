import { toHex, formatEth } from "./utils.js";
import { getProvider, initTabs, loadNetworks, populateNetworkSelect, ensureChain } from "./wallets.js";

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
function short(addr) { return addr ? addr.slice(0,6) + "…" + addr.slice(-4) : "-"; }

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
  networks = await loadNetworks();
  populateNetworkSelect(networks);
  networkSelect.addEventListener('change', async ()=> { await ensureChain(networkSelect.value); await refresh(); });
}

connectBtn.addEventListener("click", connect);
disconnectBtn.addEventListener("click", disconnect);

init();
