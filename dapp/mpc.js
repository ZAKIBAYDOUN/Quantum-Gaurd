export function startMpcFlow() {
  // Placeholder for 2-of-2 cosigner handshake (e.g., QR deep link to cosigner service)
  const url = 'https://example-cosigner.invalid/session/' + Math.random().toString(36).slice(2);
  return { ok: true, url };
}
