export function toHex(str) {
  const bytes = new TextEncoder().encode(str);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// Formatea balance hex a ETH (BigInt)
export function formatEth(balanceHex) {
  if (!balanceHex) return '0';
  const wei = BigInt(balanceHex);
  const ether = wei / 1_000_000_000_000_000_000n; // 1e18
  const decimals = (wei % 1_000_000_000_000_000_000n).toString().padStart(18, '0').slice(0, 4);
  return `${ether.toString()}.${decimals}`;
}
