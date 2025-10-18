// Minimal IndexedDB helper (promisified)
(function(){
  const dbName = 'oakhill-media-lab';
  const version = 1;
  let db;

  window.idbReady = new Promise((resolve, reject)=>{
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = e=>{
      const db = e.target.result;
      db.createObjectStore('users', { keyPath:'email' });
      db.createObjectStore('settings', { keyPath:'key' });
      db.createObjectStore('projects', { keyPath:'id' }); // {id: email, stages:{...}, feedback:{}}
      db.createObjectStore('files', { keyPath:'id' });    // {id, email, stage, name, type, blob}
    };
    req.onsuccess = ()=>{ db = req.result; resolve(db); };
    req.onerror = ()=>reject(req.error);
  });

  window.idb = {
    async put(store, value){ const d=await idbReady; return tx(d, store, 'readwrite').put(value); },
    async get(store, key){ const d=await idbReady; return tx(d, store).get(key); },
    async getAll(store){ const d=await idbReady; return tx(d, store).getAll(); },
    async delete(store, key){ const d=await idbReady; return tx(d, store, 'readwrite').delete(key); }
  };

  function tx(db, store, mode='readonly'){
    const t = db.transaction(store, mode).objectStore(store);
    return {
      put:v=>req(t.put(v)),
      get:k=>req(t.get(k)),
      getAll:()=>req(t.getAll()),
      delete:k=>req(t.delete(k))
    };
  }
  function req(r){ return new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
})();