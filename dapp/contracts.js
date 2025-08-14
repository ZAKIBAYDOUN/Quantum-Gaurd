import { formatEth } from "./utils.js";

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function $(id) { return document.getElementById(id); }

async function ensureChain(wantedChainId) {
  if (!wantedChainId) return;
  const eth = window.ethereum;
  if (!eth) return;
  const current = await eth.request({ method: 'eth_chainId' });
  if (current !== wantedChainId) {
    // prompt user to switch; ignore if rejected
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: wantedChainId }] });
    } catch {}
  }
}

async function init() {
  const cfg = await loadJSON('./contracts.json');
  await ensureChain(cfg.chainId);

  if (!window.ethereum) return;
  // Load ethers v6 from CDN if not present
  if (!window.ethers) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.umd.min.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }

  const provider = new window.ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner().catch(() => null);

  for (const c of cfg.contracts || []) {
    try {
      const abi = await loadJSON(c.abi);
      const contract = new window.ethers.Contract(c.address, abi, signer || provider);
      // Try neuronCount() if exists
      if (abi.some(item => item.type === 'function' && item.name === 'neuronCount' && item.inputs.length === 0)) {
        const el = $('neurons');
        if (el) {
          const count = await contract.neuronCount();
          el.textContent = count.toString();
        }
      }
    } catch (e) {
      console.warn('Contract init failed', c.name, e);
    }
  }
}

window.addEventListener('load', () => {
  // Defer a tick to let index/app finish
  setTimeout(init, 200);
});
