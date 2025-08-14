export async function signTypedData(provider, account, typedData) {
  // typedData should follow EIP-712 v4 shape { domain, types, primaryType, message }
  const payload = JSON.stringify(typedData);
  return await provider.request({ method: 'eth_signTypedData_v4', params: [account, payload] });
}

export function exampleTypedData(chainId, verifyingContract) {
  return {
    domain: { name: 'SuperCore', version: '1', chainId, verifyingContract },
    primaryType: 'Message',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      Message: [ { name: 'purpose', type: 'string' }, { name: 'timestamp', type: 'uint256' } ]
    },
    message: { purpose: 'SuperCore attest', timestamp: Math.floor(Date.now() / 1000) }
  };
}
