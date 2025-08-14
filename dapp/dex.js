export function minOut(amountIn, slippageBps) {
  // amountIn and return in string decimal; slippage in basis points
  const a = BigInt(amountIn);
  return (a * (10_000n - BigInt(slippageBps))) / 10_000n;
}
