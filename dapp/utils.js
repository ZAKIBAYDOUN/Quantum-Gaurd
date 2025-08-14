export function toHex(str) {
  return "0x" + Buffer.from(str, "utf8").toString("hex");
}

// Formatea balance hex a ETH (BigInt)
export function formatEth(balanceHex) {
  if (!balanceHex) return "0";
  const wei = BigInt(balanceHex);
  const ether = wei / 10_000_000_000_000_000n; // 1e18 truncado
  const decimals = (wei % 10_000_000_000_000_000n).toString().padStart(18, "0").slice(0, 4);
  return `${ether.toString()}.${decimals}`;
}
