// @ts-nocheck
/* Ids. The cryptographic ones stay server-side; these are for local keys. */
const A = 'abcdefghjkmnpqrstuvwxyz23456789';
const rand = n => { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; };
export const token = (n = 18) => Array.from(rand(n), b => A[b % A.length]).join('');
export const planCode = () => Array.from(rand(8), b => A[b % A.length]).join('');
export const hash = v => {
  let h = 0x811c9dc5; const s = String(v);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0').repeat(4);
};
export const sign = p => btoa(JSON.stringify(p));
export const verify = () => null;
export default { token, planCode, hash, sign, verify };
