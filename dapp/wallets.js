export const state = { providers: [], selected: null };

// EIP-6963 provider discovery
window.addEventListener('eip6963:announceProvider', (event) => {
  const { info, provider } = event.detail;
  if (!state.providers.find(p => p.info.uuid === info.uuid)) {
    state.providers.push({ info, provider });
  }
});
window.dispatchEvent(new Event('eip6963:requestProvider')); // request announcements

export function getProvider() {
  if (state.selected) return state.selected.provider;
  return window.ethereum || state.providers[0]?.provider || null;
}

// Tabs simple
export function initTabs() {
  const buttons = document.querySelectorAll('nav.tabs button');
  const sections = {
    overview: document.getElementById('tab-overview'),
    neurons: document.getElementById('tab-neurons'),
    zk: document.getElementById('tab-zk'),
    mev: document.getElementById('tab-mev'),
    mpc: document.getElementById('tab-mpc'),
    dex: document.getElementById('tab-dex'),
  };
  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(sections).forEach(s => s.hidden = true);
    const key = btn.getAttribute('data-tab');
    sections[key].hidden = false;
  }));
}

// Networks

}

export async function ensureChain(chainId, networks) {\n  const eth = getProvider(); if (!eth) return;\n  const current = await eth.request({ method: "eth_chainId" });\n  if (current === chainId) return;\n  try {\n    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });\n    return;\n  } catch (e) {\n    const n = (networks||[]).find(n => n.chainId === chainId);\n    if (!n) return;\n    try {\n      await eth.request({ method: "wallet_addEthereumChain", params: [{\n        chainId: n.chainId, chainName: n.name, nativeCurrency: n.nativeCurrency, rpcUrls: n.rpc, blockExplorerUrls: n.blockExplorerUrls\n      }] });\n    } catch (_) {}\n  }\n});
  if (current !== chainId) {
    try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] }); } catch {}
  }
}


export async function loadConfig() {
  try { const r = await fetch('./chains.config.json', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch {}
  return { defaultChain: null, enabledChains: [] };
}

export async function loadNetworks() {
  const [netsRes, cfg] = await Promise.all([
    fetch('./networks.json', { cache: 'no-store' }),
    loadConfig()
  ]);
  const nets = await netsRes.json();
  if (cfg.enabledChains && cfg.enabledChains.length) {
    return nets.filter(n => cfg.enabledChains.includes(n.chainId));
  }
  return nets;
}

export function populateNetworkSelect(networks, cfg) {
  const sel = document.getElementById('networkSelect');
  sel.innerHTML = '';
  for (const n of networks) {
    const opt = document.createElement('option');
    opt.value = n.chainId; opt.textContent = n.name; sel.appendChild(opt);
  }
  if (cfg?.defaultChain) {
    const found = Array.from(sel.options).find(o => o.value === cfg.defaultChain);
    if (found) sel.value = cfg.defaultChain;
  }
}
