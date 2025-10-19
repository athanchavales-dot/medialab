(function(){
  const dbName = 'oakhill-media-lab';
  const requestedVersion = 12; // current schema version for this build
  let db;

  // Helper: open with adaptive version (avoids "requested version is less than existing version" errors)
  async function openAdaptive(dbName, requestedVersion, onUpgrade){
    let existingVersion = null;

    // 1) Try the modern API to read existing versions
    if (indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        const rec = dbs.find(d => d.name === dbName);
        if (rec && typeof rec.version === 'number') existingVersion = rec.version;
      } catch (_) { /* ignore */ }
    }

    // 2) Fallback: open without version to discover (will not downgrade)
    if (existingVersion == null) {
      try {
        const probe = await new Promise((resolve, reject) => {
          const r = indexedDB.open(dbName);
          let upgraded = false;
          r.onupgradeneeded = () => { upgraded = true; };
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        existingVersion = probe.version || null;
        probe.close();
      } catch (_) {
        // If open failed because db doesn't exist, leave existingVersion as null
      }
    }

    const finalVersion = existingVersion ? Math.max(existingVersion, requestedVersion) : requestedVersion;

    return await new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, finalVersion);
      req.onupgradeneeded = (e) => onUpgrade && onUpgrade(e);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  window.idbReady = (async () => {
    db = await openAdaptive(dbName, requestedVersion, (e) => {
      const db = e.target.result;
      // Create object stores if missing (idempotent)
      if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath:'email' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath:'key' });
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath:'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath:'id' });
      if (!db.objectStoreNames.contains('comments')) db.createObjectStore('comments', { keyPath:'id' });
      if (!db.objectStoreNames.contains('submissions')) db.createObjectStore('submissions', { keyPath:'id' });
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath:'id' });
    });
    return db;
  })();

  window.idb = {
    async put(store, value){ const d=await idbReady; return tx(d, store, 'readwrite').put(value); },
    async get(store, key){ const d=await idbReady; return tx(d, store).get(key); },
    async getAll(store){ const d=await idbReady; return tx(d, store).getAll(); },
    async delete(store, key){ const d=await idbReady; return tx(d, store, 'readwrite').delete(key); }
  };

  function tx(db, store, mode='readonly'){
    const t = db.transaction(store, mode).objectStore(store);
    return { put:v=>req(t.put(v)), get:k=>req(t.get(k)), getAll:()=>req(t.getAll()), delete:k=>req(t.delete(k)) };
  }
  function req(r){ return new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
})();