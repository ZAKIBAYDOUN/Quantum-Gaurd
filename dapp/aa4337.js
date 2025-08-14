export async function sendUserOperation(bundlerUrl, userOperation, entryPoint) {
  const body = { jsonrpc: '2.0', id: 1, method: 'eth_sendUserOperation', params: [ userOperation, entryPoint ] };
  const res = await fetch(bundlerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Bundler error');
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Bundler returned error');
  return json.result;
}

export function exampleUserOperation(sender, callDataHex) {
  // Minimal skeleton; must be filled by a bundler helper or AA SDK in production
  return {
    sender,
    nonce: '0x0',
    initCode: '0x',
    callData: callDataHex,
    callGasLimit: '0x0', paymasterAndData: '0x', verificationGasLimit: '0x0', preVerificationGas: '0x0',
    maxFeePerGas: '0x0', maxPriorityFeePerGas: '0x0', signature: '0x'
  };
}
