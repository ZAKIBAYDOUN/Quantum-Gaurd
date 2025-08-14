const MULTICALL_ADDR = {
  '0x1': '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696', // Mainnet
  '0xaa36a7': '0xAe42A79a84ca9Db27F940C8C247c9A37b8b03341' // Sepolia community multicall (example)
};

const MULTICALL_ABI = [
  {
    "inputs": [
      { "components": [ {"internalType":"address","name":"target","type":"address"}, {"internalType":"bytes","name":"callData","type":"bytes"} ], "internalType":"struct Call[]","name":"calls","type":"tuple[]" }
    ],
    "name": "aggregate",
    "outputs": [ {"internalType":"uint256","name":"blockNumber","type":"uint256"}, {"internalType":"bytes[]","name":"returnData","type":"bytes[]"} ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export async function multicall(provider, chainIdHex, calls) {
  if (!window.ethers) throw new Error('ethers not loaded');
  const addr = MULTICALL_ADDR[chainIdHex];
  if (!addr) throw new Error('No multicall for this chain');
  const p = new window.ethers.BrowserProvider(provider);
  const c = new window.ethers.Contract(addr, MULTICALL_ABI, await p.getSigner().catch(()=>p));
  const res = await c.aggregate(calls);
  return res;
}

export async function batchNeuronCounts(provider, chainIdHex, config) {
  if (!window.ethers) throw new Error('ethers not loaded');
  const iface = new window.ethers.Interface([{ "inputs": [], "name": "neuronCount", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view", "type":"function" }]);
  const calls = [];
  for (const c of (config.contracts||[])) {
    calls.push({ target: c.address, callData: iface.encodeFunctionData('neuronCount', []) });
  }
  const { returnData } = await multicall(provider, chainIdHex, calls);
  return returnData.map((bytes) => {
    try { return window.ethers.toBigInt(bytes).toString(); } catch { return '0'; }
  });
}
