// @ts-nocheck
/* Browser store — localStorage, same interface as planzo/lib/store.js. */
const P = 'planzo.kv.';
const mem = new Map();
function read(k) {
  try { const r = localStorage.getItem(P + k); return r == null ? null : JSON.parse(r); }
  catch { return mem.has(k) ? mem.get(k) : null; }
}
function write(k, v) {
  try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { mem.set(k, v); }
}
async function get(k) {
  const parsed = read(k);
  if (parsed && typeof parsed === 'object' && 'v' in parsed && 'exp' in parsed) {
    if (parsed.exp && parsed.exp < Date.now()) { try { localStorage.removeItem(P + k); } catch {} return null; }
    return parsed.v;
  }
  return parsed;
}
async function set(k, v, ttl) { write(k, ttl ? { v, exp: Date.now() + ttl * 1000 } : v); return true; }
async function del(k) { try { localStorage.removeItem(P + k); } catch {} mem.delete(k); return true; }
async function incrBy(k, n) { const c = Number(await get(k)) || 0; await set(k, c + n); return c + n; }
async function setIfAbsent(k, v) { if ((await get(k)) != null) return false; await set(k, v); return true; }
async function push(k, item, cap = 500) {
  const a = (await get(k)) || []; a.push(item);
  while (a.length > cap) a.shift();
  await set(k, a); return a;
}
export { get, set, del, incrBy, setIfAbsent, push };
export default { get, set, del, incrBy, setIfAbsent, push, remote: false, PREFIX: P };
