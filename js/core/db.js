/* IndexedDB 래퍼 (DATA_MODEL.md §3.0). 화면에서는 indexedDB를 직접 쓰지 않는다. */
(function () {
  'use strict';
  const SCHEMA_VERSION = 1;
  const STORES = ['topics', 'problemSets', 'assets', 'lessons', 'activityRecords', 'settings', 'meta'];
  let dbName = 'hangul-classroom';
  let dbPromise = null;

  /** 버전별 마이그레이션. 각 함수는 멱등이어야 한다. */
  const migrations = {
    1(db) {
      const has = (n) => db.objectStoreNames.contains(n);
      if (!has('topics')) db.createObjectStore('topics', { keyPath: 'id' }).createIndex('order', 'order');
      if (!has('problemSets')) {
        const s = db.createObjectStore('problemSets', { keyPath: 'id' });
        s.createIndex('topicId', 'topicId');
        s.createIndex('level', 'level');
        s.createIndex('topicLevel', ['topicId', 'level']);
        s.createIndex('updatedAt', 'updatedAt');
      }
      if (!has('assets')) {
        const s = db.createObjectStore('assets', { keyPath: 'id' });
        s.createIndex('sha256', 'sha256', { unique: true });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!has('lessons')) {
        const s = db.createObjectStore('lessons', { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('status', 'status');
      }
      if (!has('activityRecords')) {
        const s = db.createObjectStore('activityRecords', { keyPath: 'id' });
        s.createIndex('lessonId', 'lessonId');
        s.createIndex('startedAt', 'startedAt');
        s.createIndex('activity', 'activity');
        s.createIndex('problemSetId', 'problemSetId');
      }
      if (!has('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!has('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    }
  };

  function reqP(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function doneP(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('트랜잭션이 취소되었습니다'));
    });
  }

  function open(name) {
    if (name && name !== dbName) { close(); dbName = name; }
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('NO_INDEXEDDB')); return; }
      let req;
      try { req = indexedDB.open(dbName, SCHEMA_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = (e) => {
        const db = req.result;
        for (let v = e.oldVersion + 1; v <= SCHEMA_VERSION; v++) if (migrations[v]) migrations[v](db, req.transaction);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('다른 창에서 앱이 열려 있습니다. 다른 창을 닫고 다시 열어 주세요.'));
    });
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }
  function close() {
    if (dbPromise) dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }

  async function get(store, key) { const db = await open(); return reqP(db.transaction(store).objectStore(store).get(key)); }
  async function getAll(store) { const db = await open(); return reqP(db.transaction(store).objectStore(store).getAll()); }
  async function getAllByIndex(store, index, value) {
    const db = await open();
    return reqP(db.transaction(store).objectStore(store).index(index).getAll(value));
  }
  async function count(store) { const db = await open(); return reqP(db.transaction(store).objectStore(store).count()); }
  async function put(store, value) {
    const db = await open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    return doneP(tx);
  }
  async function del(store, key) {
    const db = await open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    return doneP(tx);
  }
  /** 여러 store에 대한 단일 readwrite 트랜잭션. fn(tx) 안에서 동기적으로 요청만 넣는다. 실패 시 전체 롤백. */
  async function write(stores, fn) {
    const db = await open();
    const tx = db.transaction(stores, 'readwrite');
    const p = doneP(tx);
    try { fn(tx); } catch (e) { try { tx.abort(); } catch (_) { /* 이미 종료 */ } p.catch(() => {}); throw e; }
    return p;
  }
  async function deleteDatabase() {
    close();
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  }

  HG.db = { SCHEMA_VERSION, STORES, migrations, open, close, get, getAll, getAllByIndex, count, put, del, write, deleteDatabase, name: () => dbName };
})();
