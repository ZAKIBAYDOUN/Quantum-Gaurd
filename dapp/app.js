import { toHex, formatEth } from "./utils.js";

const $ = (id) => document.getElementById(id);
const connectBtn = $("connectBtn");
const disconnectBtn = $("disconnectBtn");
const statusEl = $("status");
const chainEl = $("chain");
const accountEl = $("account");
const balanceEl = $("balance");
const sigEl = $("sig");

let currentAccount = null;

function provider() {
  return window.ethereum || null;
}

function short(addr) {
  if (!addr) return "-";
  return addr.slice(0, 6) + "" + addr.slice(-4);
}

async function connect() {
  const eth = provider();
  if (!eth) {
    statusEl.textContent = "No hay proveedor Web3. Instala MetaMask.";
    window.open("https://metamask.io/download/", "_blank");
    return;
  }
  try {
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    currentAccount = accounts[0] || null;
    await refresh();
    eth.on?.("accountsChanged", handleAccountsChanged);
    eth.on?.("chainChanged", handleChainChanged);
    connectBtn.style.display = "none";
    disconnectBtn.style.display = "";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Conexión cancelada";
  }
}

function disconnect() {
  currentAccount = null;
  accountEl.textContent = "-";
  balanceEl.textContent = "-";
  statusEl.textContent = "No conectado";
  sigEl.textContent = "";
  connectBtn.style.display = "";
  disconnectBtn.style.display = "none";
}

async function handleAccountsChanged(accs) {
  currentAccount = accs?.[0] || null;
  await refresh();
}

async function handleChainChanged(_hex) {
  await refresh();
}

async function getChainId() {
  const eth = provider();
  if (!eth) return null;
  const idHex = await eth.request({ method: "eth_chainId" });
  return idHex;
}

async function getBalance(addr) {
  const eth = provider();
  if (!eth || !addr) return null;
  const balHex = await eth.request({ method: "eth_getBalance", params: [addr, "latest"] });
  return balHex;
}

async function refresh() {
  const eth = provider();
  if (!eth) return;
  const chainIdHex = await getChainId();
  const chainId = parseInt(chainIdHex, 16);
  chainEl.textContent = `chainId ${chainId} (${chainIdHex})`;
  if (currentAccount) {
    accountEl.textContent = currentAccount;
    const bal = await getBalance(currentAccount);
    balanceEl.textContent = formatEth(bal) + " ETH";
    statusEl.textContent = "Conectado";
  } else {
    statusEl.textContent = "No conectado";
  }
}

async function signMessage() {
  const eth = provider();
  if (!eth || !currentAccount) return;
  try {
    const msg = `SuperCore proof @ ${new Date().toISOString()}`;
    const hexMsg = toHex(msg);
    const signature = await eth.request({
      method: "personal_sign",
      params: [hexMsg, currentAccount],
    });
    sigEl.textContent = signature;
  } catch (e) {
    sigEl.textContent = "Firma cancelada";
  }
}

connectBtn.addEventListener("click", connect);
disconnectBtn.addEventListener("click", disconnect);
$("signBtn").addEventListener("click", signMessage);

refresh();
