/**
 * Identifiers for ledger rows.
 *
 * Uses the Web Crypto API, which both a browser and Node provide, so the
 * ledger engine runs in either without a platform-specific import.
 */

function randomId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID().replace(/-/g, '').slice(0, 20);
  }
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(10));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Last resort: still unique within a session, never used for security.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomId()}`;
}
