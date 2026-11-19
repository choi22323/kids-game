/* 엔터티 저장소: 설정 기본값·범위 교정, 공통 조회/저장 (DATA_MODEL.md §3) */
(function () {
  'use strict';
  const db = HG.db;

  const PRAISE = ['참 잘하셨어요!', '훌륭해요!', '정답이에요, 박수!', '멋지게 해내셨어요!'];
  const RETRY = ['괜찮아요, 한 번 더 해 볼까요?', '거의 다 왔어요!'];
  const isStrList = (v) => Array.isArray(v) && v.length >= 1 && v.length <= 10 && v.every((s) => typeof s === 'string' && s.trim().length >= 1 && s.length <= 20);
  const SETTINGS = {
    fontScale: { def: 1, ok: (v) => [1, 1.15, 1.3].includes(v) },
    soundEnabled: { def: true, ok: (v) => typeof v === 'boolean' },
    volume: { def: 0.6, ok: (v) => typeof v === 'number' && v >= 0 && v <= 1 },
    reduceMotion: { def: 'auto', ok: (v) => ['auto', 'on', 'off'].includes(v) },
    dictGuide: { def: 'off', ok: (v) => ['off', 'always'].includes(v) },
    ttsRate: { def: 0.85, ok: (v) => typeof v === 'number' && v >= 0.5 && v <= 1.2 },
    traceStrokeWidth: { def: 24, ok: (v) => Number.isInteger(v) && v >= 12 && v <= 40 },
    shuffleQuestions: { def: false, ok: (v) => typeof v === 'boolean' },
    praiseMessages: { def: PRAISE, ok: isStrList },
    retryMessages: { def: RETRY, ok: isStrList },
    backupReminderDays: { def: 7, ok: (v) => Number.isInteger(v) && v >= 0 && v <= 30 },
    recordRetentionMonths: { def: 12, ok: (v) => Number.isInteger(v) && v >= 0 && v <= 60 },
    adminPinHash: { def: null, ok: (v) => v === null || (typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)) },
    adminPinSalt: { def: null, ok: (v) => v === null || (typeof v === 'string' && /^[0-9a-f]{32}$/.test(v)) },
    institutionName: { def: '서구종합사회복지관', ok: (v) => typeof v === 'string' && v.trim().length >= 1 && v.length <= 30 },
    programName: { def: '우리들의 즐거운 한글 교실', ok: (v) => typeof v === 'string' && v.trim().length >= 1 && v.length <= 30 }
  };

  function defaults() {
    const out = {};
    Object.keys(SETTINGS).forEach((k) => { const d = SETTINGS[k].def; out[k] = Array.isArray(d) ? d.slice() : d; });
    return out;
  }
  function validSetting(key, value) { return !!SETTINGS[key] && SETTINGS[key].ok(value); }

  async function loadSettings() {
    const s = defaults();
    (await db.getAll('settings')).forEach((row) => { if (validSetting(row.key, row.value)) s[row.key] = row.value; });
    HG.state.settings = s;
    return s;
  }
  async function setSetting(key, value) {
    if (!validSetting(key, value)) throw new Error('설정 값이 올바르지 않습니다: ' + key);
    await db.put('settings', { key, value });
    HG.state.settings[key] = value;
    HG.events.emit('settings', { key, value });
  }
  async function resetSettings() {
    const keep = { adminPinHash: HG.state.settings.adminPinHash, adminPinSalt: HG.state.settings.adminPinSalt };
    const d = Object.assign(defaults(), keep);
    await db.write(['settings'], (tx) => {
      const st = tx.objectStore('settings');
      Object.keys(d).forEach((k) => st.put({ key: k, value: d[k] }));
    });
    HG.state.settings = d;
    HG.events.emit('settings', {});
  }

  async function getMeta(key) { const r = await db.get('meta', key); return r ? r.value : undefined; }
  async function setMeta(key, value) { return db.put('meta', { key, value }); }

  async function topics() { return (await db.getAll('topics')).sort((a, b) => a.order - b.order); }
  async function sets() { return db.getAll('problemSets'); }
  async function setsMap() { const m = {}; (await sets()).forEach((s) => { m[s.id] = s; }); return m; }
  async function topicsMap() { const m = {}; (await topics()).forEach((t) => { m[t.id] = t; }); return m; }

  function touch(obj, isNew) {
    const now = HG.format.nowISO();
    if (isNew || !obj.createdAt) obj.createdAt = now;
    obj.updatedAt = now;
    return obj;
  }

  /** 세트를 참조하는 '예정' 수업 계획 */
  async function plansUsingSet(setId) {
    return (await db.getAll('lessons')).filter((l) => l.status === 'planned' && (l.activityPlan || []).some((s) => s.problemSetId === setId));
  }
  /** 이미지 사용처(세트 목록) */
  async function setsUsingAsset(assetId) {
    return (await sets()).filter((s) => s.words.some((w) => w.image && w.image.kind === 'asset' && w.image.ref === assetId));
  }

  HG.repo = {
    SETTINGS, defaults, validSetting, loadSettings, setSetting, resetSettings,
    getMeta, setMeta, topics, sets, setsMap, topicsMap, touch, plansUsingSet, setsUsingAsset,
    get: db.get, all: db.getAll, put: db.put, del: db.del
  };
})();
