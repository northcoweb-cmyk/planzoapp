/* HouseDAW — local persistence with IndexedDB (projects, imported audio, generated sounds, settings).
   Falls back to in-memory if IndexedDB is unavailable. Nothing ever leaves the browser. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const St = (HD.Store = { mem: { projects: {}, assets: {}, sounds: {}, kv: {} }, db: null });
  const DB = 'housedaw', STORES = ['projects', 'assets', 'sounds', 'kv'];

  St.open = () => new Promise((res) => {
    if (St.db) return res(St.db);
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { for (const s of STORES) if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s, { keyPath: 'id' }); };
      rq.onsuccess = () => { St.db = rq.result; res(St.db); };
      rq.onerror = () => res(null); rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  const tx = async (store, mode, fn) => {
    const db = await St.open();
    if (!db) return fn(null);
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode), os = t.objectStore(store); let out;
      const r = fn(os); if (r && r.onsuccess !== undefined) { r.onsuccess = () => (out = r.result); }
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  St.put = async (store, obj) => { const db = await St.open(); if (!db) { St.mem[store][obj.id] = obj; return; } return tx(store, 'readwrite', (os) => os.put(obj)); };
  St.get = async (store, id) => { const db = await St.open(); if (!db) return St.mem[store][id]; return tx(store, 'readonly', (os) => os.get(id)); };
  St.all = async (store) => { const db = await St.open(); if (!db) return Object.values(St.mem[store]); return tx(store, 'readonly', (os) => os.getAll()); };
  St.del = async (store, id) => { const db = await St.open(); if (!db) { delete St.mem[store][id]; return; } return tx(store, 'readwrite', (os) => os.delete(id)); };

  St.setKV = (k, v) => St.put('kv', { id: k, v });
  St.getKV = async (k, d) => { const r = await St.get('kv', k); return r ? r.v : d; };

  // projects
  St.saveProject = async (p) => { HD.State.embedSounds(); const o = { id: p.id, name: p.name, updated: Date.now(), bpm: p.bpm, data: JSON.parse(JSON.stringify(p)) }; await St.put('projects', o); return o; };
  St.listProjects = async () => (await St.all('projects')).map((p) => ({ id: p.id, name: p.name, updated: p.updated, bpm: p.bpm })).sort((a, b) => b.updated - a.updated);
  St.loadProject = async (id) => { const r = await St.get('projects', id); return r ? r.data : null; };
  St.deleteProject = (id) => St.del('projects', id);

  // imported audio: store the original file bytes + metadata, decode again on load
  St.saveAsset = (a) => St.put('assets', a);
  St.loadAssets = () => St.all('assets');
  St.deleteAsset = (id) => St.del('assets', id);
  // generated sounds / user instrument presets
  St.saveSound = (s) => St.put('sounds', s);
  St.loadSounds = () => St.all('sounds');
  St.deleteSound = (id) => St.del('sounds', id);
})();
