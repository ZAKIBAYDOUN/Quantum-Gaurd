(function(){
  const N = [];
  function addNeuron(id, name, collect){ N.push({ id, name, collect }); }
  async function withProvider(){ if (!window.ethers||!window.provider) throw new Error('Connect a wallet'); return new ethers.BrowserProvider(window.provider); }
  // Core chain neurons
  addNeuron(1,'chain.info', async()=>{ const p=await withProvider(); const n=await p.getNetwork(); const fee=await p.getFeeData(); return { chainId: Number(n.chainId), name: n.name||'custom', gasPrice: String(fee.gasPrice||'') }; });
  addNeuron(2,'block.head', async()=>{ const p=await withProvider(); const bn=await p.getBlockNumber(); const b=await p.getBlock(bn); return { number: bn, timestamp: b?.timestamp, txs: b?.transactions?.length } });
  addNeuron(3,'account.balance', async()=>{ const p=await withProvider(); const a=window.currentAccount; if(!a) return {}; const b=await p.getBalance(a); return { account:a, balance: b.toString() }; });
  // Contracts
  async function callContract(name, fn, args=[]) {
    const c = (window.currentContracts||window.contracts||{})[name]; if(!c) return {};
    const abi = await (await fetch(c.abi)).json(); const provider = await withProvider(); const ca = new ethers.Contract(c.address, abi, await provider.getSigner());
    if (!ca[fn]) return {}; const out = await ca[fn](...args); return { [fn]: out };
  }
  addNeuron(4,'mining.params', async()=> callContract('Token5470Mining','getMiningParams'));
  addNeuron(5,'mining.stats', async()=>{ const a=window.currentAccount; if(!a) return {}; return callContract('Token5470Mining','getMinerStats',[a]); });
  addNeuron(6,'mining.networkStats', async()=> callContract('Token5470Mining','getNetworkStats'));
  addNeuron(7,'qnn.score', async()=>{ const a=window.currentAccount; if(!a) return {}; const r = await (window.QNN?.qnnValidate?.(a)); return { score: r?.score, decision: r?.decision, method: r?.method }; });
  addNeuron(8,'mpc.owners', async()=>{ const p=await withProvider(); const c=(window.currentContracts||window.contracts||{}).MPCSmartWallet; if(!c) return {}; const abi=await (await fetch(c.abi)).json(); const ca=new ethers.Contract(c.address, abi, await p.getSigner()); const A=ca.ownerA? await ca.ownerA(): null; const B=ca.ownerB? await ca.ownerB(): null; return { ownerA: A, ownerB: B }; });
  addNeuron(9,'rpc.urls', async()=>{ const map = window.currentContractsMap || window.contractsMap || {}; const rpc = map?.rpc || []; return { rpc } });
  // Fill remaining to 32 with useful queries
  addNeuron(10,'gas.feeData', async()=>{ const p=await withProvider(); const f=await p.getFeeData(); return { maxFeePerGas: String(f.maxFeePerGas||''), maxPriorityFeePerGas: String(f.maxPriorityFeePerGas||'') } });
  addNeuron(11,'time.now', async()=>({ now: Math.floor(Date.now()/1000) }));
  addNeuron(12,'account.nonce', async()=>{ const p=await withProvider(); const a=window.currentAccount; if(!a) return {}; const n=await p.getTransactionCount(a); return { account:a, nonce:n }; });
  addNeuron(13,'code.mining', async()=>{ const p=await withProvider(); const c=(window.currentContracts||window.contracts||{}).Token5470Mining; if(!c) return {}; const code = await p.send('eth_getCode',[c.address,'latest']); return { address:c.address, hasCode: code && code!=='0x' }; });
  addNeuron(14,'peers.placeholder', async()=>({ note:'peer info not available via standard JSON-RPC' }));
  addNeuron(15,'txpool.placeholder', async()=>({ note:'mempool access may require custom RPC methods' }));
  addNeuron(16,'explorers', async()=>{ try { const nets = await fetch('./networks.json').then(r=>r.json()); const n = nets.find(x=>x.chainId===5470); return { explorers: n?.explorers||[] }; } catch { return {} } });
  addNeuron(17,'currency', async()=>{ try { const nets = await fetch('./networks.json').then(r=>r.json()); const n = nets.find(x=>x.chainId===5470); return { currency: n?.currency||{} }; } catch { return {} } });
  addNeuron(18,'contracts.list', async()=>{ const map = await fetch('./contracts.json').then(r=>r.json()); return { contracts: map.contracts ? Object.keys(map.contracts): [] } });
  addNeuron(19,'blockchain.health', async()=>{ try { const p=await withProvider(); await p.getBlockNumber(); return { ok:true } } catch(e){ return { ok:false, error: e?.message||String(e) } } });
  addNeuron(20,'abi.health', async()=>{ try { const map=await fetch('./contracts.json').then(r=>r.json()); const ok = await Promise.all(Object.values(map.contracts||{}).map(async v=> (await fetch(v.abi)).ok)); return { ok: ok.every(Boolean) } } catch { return { ok:false } } });
  addNeuron(21,'account.health', async()=>({ ok: !!window.currentAccount }));
  addNeuron(22,'network.id', async()=>{ const p=await withProvider(); const n=await p.getNetwork(); return { hex:'0x'+Number(n.chainId).toString(16), dec:Number(n.chainId) } });
  addNeuron(23,'latest.txs.placeholder', async()=>({ note:'fetch via explorer API if needed' }));
  addNeuron(24,'mining.reward', async()=>{ const r=await callContract('Token5470Mining','getMiningParams'); const v=r?.getMiningParams || r; return v? { reward: String(v[2]) } : {}; });
  addNeuron(25,'qnn.threshold.placeholder', async()=>({ note:'threshold read if ABI exposes it' }));
  addNeuron(26,'mpc.threshold', async()=>{ const p=await withProvider(); const c=(window.currentContracts||window.contracts||{}).MPCSmartWallet; if(!c) return {}; const abi=await (await fetch(c.abi)).json(); const ca=new ethers.Contract(c.address, abi, await p.getSigner()); if (!ca.getThreshold) return {}; const t = await ca.getThreshold(); return { threshold: Number(t) }; });
  addNeuron(27,'wallet.network', async()=>({ provider: !!window.provider, ethers: !!window.ethers }));
  addNeuron(28,'contracts.rpc', async()=>{ const map=await fetch('./contracts.json').then(r=>r.json()); return { rpc: map.rpc||[] } });
  addNeuron(29,'serviceworker', async()=>({ sw: 'serviceWorker' in navigator }));
  addNeuron(30,'pwa', async()=>({ manifest: !!document.querySelector('link[rel="manifest"]') }));
  addNeuron(31,'storage', async()=>({ localStorage: !!window.localStorage }));
  addNeuron(32,'version', async()=>({ ts: new Date().toISOString() }));

  async function snapshot(){ const out={}; for (const n of N){ try{ out[n.name]= await n.collect(); }catch(e){ out[n.name]={ error: e?.message||String(e) }; }} return out; }
  function answer(q, data){
    const text = (q||'').toLowerCase();
    function pick(...keys){ for (const k of keys){ if (data[k]) return data[k]; } return null; }
    if (text.includes('gas')||text.includes('fee')) return pick('gas.feeData','chain.info')||{};
    if (text.includes('block')||text.includes('height')) return pick('block.head','mining.params')||{};
    if (text.includes('balance')) return pick('account.balance')||{};
    if (text.includes('mining')||text.includes('reward')) return pick('mining.params','mining.stats','mining.networkStats')||{};
    if (text.includes('qnn')||text.includes('score')) return pick('qnn.score')||{};
    if (text.includes('mpc')||text.includes('owner')) return pick('mpc.owners','mpc.threshold')||{};
    if (text.includes('rpc')||text.includes('explorer')) return pick('rpc.urls','explorers')||{};
    if (text.includes('contract')) return pick('contracts.list')||{};
    if (text.includes('health')||text.includes('status')) return pick('blockchain.health','abi.health','account.health')||{};
    return { info: 'Ask about gas, blocks, mining, QNN, MPC, RPC, contracts, health' };
  }

  async function handleQuestion(q){ const data = await snapshot(); return { neurons: N.length, data: answer(q, data) } }

  window.Neurons32 = { neurons: N, snapshot, handleQuestion };
})();
