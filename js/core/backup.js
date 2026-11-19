/* 백업·복원·세트 공유 (DATA_MODEL.md §5.3~5.5, FEATURES.md F-15) */
(function () {
  'use strict';
  const V = HG.validate;
  const FORMAT = 'hangul-classroom-backup';
  const SETS_FORMAT = 'hangul-classroom-sets';
  const MAX_FILE = 200 * 1024 * 1024;
  const FORBIDDEN = ['__proto__', 'constructor', 'prototype'];
  const NO_BACKUP_SETTINGS = ['adminPinHash', 'adminPinSalt'];

  /** 백업 파일 마이그레이션 표: migrations[n] 은 n-1 → n 변환 */
  const migrations = {
    1(file) { // v0(시험용 구버전): stores 이름이 sets 였던 형식 → v1
      if (file.data && file.data.sets && !file.data.problemSets) { file.data.problemSets = file.data.sets; delete file.data.sets; }
      return file;
    }
  };

  // ---------- 필드 화이트리스트 정리 ----------
  const str = (v) => (typeof v === 'string' ? V.clean(v) : '');
  const iso = (v) => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v : HG.format.nowISO());
  const int = (v, d) => (Number.isInteger(v) ? v : d);
  function image(img) {
    if (!img || typeof img !== 'object') return null;
    if (!['builtin', 'asset', 'emoji'].includes(img.kind) || typeof img.ref !== 'string' || !img.ref) return null;
    return { kind: img.kind, ref: img.kind === 'emoji' ? img.ref : str(img.ref), alt: str(img.alt) };
  }
  function cleanTopic(t) {
    return { id: str(t.id), name: str(t.name), icon: HG.labels.topicIcons.includes(t.icon) ? t.icon : 'book', order: int(t.order, 99),
      isBuiltIn: false, createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt) };
  }
  function cleanSet(s) {
    const ao = s.activityOptions || {};
    const pick = (o, d) => Object.assign({}, d, o && typeof o === 'object' ? o : {});
    return {
      id: str(s.id), title: str(s.title), topicId: str(s.topicId), level: s.level, description: str(s.description),
      isBuiltIn: false, isHidden: s.isHidden === true,
      words: (Array.isArray(s.words) ? s.words : []).map((w, i) => ({ id: str(w.id) || 'w' + (i + 1), text: str(w.text), image: image(w.image), hint: str(w.hint), order: i })),
      sentences: (Array.isArray(s.sentences) ? s.sentences : []).map((x, i) => ({ id: str(x.id) || 's' + (i + 1), text: str(x.text), answer: str(x.answer),
        distractors: (Array.isArray(x.distractors) ? x.distractors : []).slice(0, 2).map(str), order: i })),
      activityOptions: {
        trace: pick(ao.trace, { enabled: true, gridStyle: 'cross', repeat: 1 }),
        chosung: pick(ao.chosung, { enabled: true, optionCount: 3, showImageHint: true }),
        match: pick(ao.match, { enabled: true, pairsPerRound: 3 }),
        blank: pick(ao.blank, { enabled: true })
      },
      tags: (Array.isArray(s.tags) ? s.tags : []).map(str).filter(Boolean),
      sourceSetId: typeof s.sourceSetId === 'string' ? s.sourceSetId : null,
      createdAt: iso(s.createdAt), updatedAt: iso(s.updatedAt)
    };
  }
  function cleanLesson(l) {
    return {
      id: str(l.id), date: str(l.date), title: str(l.title), topicId: str(l.topicId), level: l.level,
      activityPlan: (Array.isArray(l.activityPlan) ? l.activityPlan : []).map((s, i) => ({ order: i, activity: s.activity, problemSetId: str(s.problemSetId) })),
      status: ['planned', 'inProgress', 'done', 'canceled'].includes(l.status) ? l.status : 'planned',
      participantCount: l.participantCount == null ? null : l.participantCount, memo: str(l.memo),
      startedAt: l.startedAt || null, endedAt: l.endedAt || null, createdAt: iso(l.createdAt), updatedAt: iso(l.updatedAt)
    };
  }
  function cleanRecord(r) {
    const n = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
    return {
      id: str(r.id), lessonId: typeof r.lessonId === 'string' ? r.lessonId : null, problemSetId: str(r.problemSetId), problemSetTitle: str(r.problemSetTitle),
      topicId: str(r.topicId), level: r.level, activity: r.activity, startedAt: iso(r.startedAt), endedAt: iso(r.endedAt),
      durationSec: n(r.durationSec), totalQuestions: n(r.totalQuestions), correctFirstTry: n(r.correctFirstTry), correctAfterRetry: n(r.correctAfterRetry),
      revealed: n(r.revealed), skipped: n(r.skipped), hintsUsed: n(r.hintsUsed),
      avgCoverage: typeof r.avgCoverage === 'number' ? r.avgCoverage : null, score: Math.min(100, n(r.score)), stars: Math.min(3, n(r.stars)),
      completed: r.completed === true,
      itemResults: (Array.isArray(r.itemResults) ? r.itemResults : []).map((x) => {
        const o = { itemId: str(x.itemId), text: str(x.text), attempts: n(x.attempts), result: ['first', 'retry', 'revealed', 'skipped'].includes(x.result) ? x.result : 'skipped' };
        if (typeof x.coverage === 'number') o.coverage = x.coverage;
        return o;
      })
    };
  }

  // ---------- Base64 ----------
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  function base64ToBlob(b64, mime) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime });
  }
  async function assetToJson(a) {
    return { id: a.id, label: a.label, mime: a.mime, width: a.width, height: a.height, size: a.size, sha256: a.sha256,
      dataBase64: await blobToBase64(a.blob), createdAt: a.createdAt, updatedAt: a.updatedAt };
  }

  // ---------- 내보내기 ----------
  async function wrap(format, data, extra) {
    const checksum = { algorithm: 'SHA-256', value: await HG.hash.sha256Hex(JSON.stringify(data)) };
    return Object.assign({ format, schemaVersion: HG.db.SCHEMA_VERSION, appVersion: HG.appVersion, exportedAt: HG.format.nowISO() }, extra || {}, { checksum, data });
  }
  async function buildBackup(opts) {
    opts = Object.assign({ includeRecords: true, includeImages: true }, opts || {});
    const [topics, sets, assets, lessons, records, settings] = await Promise.all(
      ['topics', 'problemSets', 'assets', 'lessons', 'activityRecords', 'settings'].map((s) => HG.db.getAll(s)));
    const data = {
      topics: topics.filter((t) => !t.isBuiltIn),
      builtInTopics: topics.filter((t) => t.isBuiltIn).map((t) => ({ id: t.id, name: t.name, order: t.order, icon: t.icon })),
      problemSets: sets.filter((s) => !s.isBuiltIn),
      builtInState: sets.filter((s) => s.isBuiltIn).map((s) => ({ id: s.id, isHidden: !!s.isHidden })),
      assets: opts.includeImages ? await Promise.all(assets.map(assetToJson)) : [],
      lessons,
      activityRecords: opts.includeRecords ? records : [],
      settings: settings.filter((r) => !NO_BACKUP_SETTINGS.includes(r.key))
    };
    const counts = { topics: data.topics.length, problemSets: data.problemSets.length, assets: data.assets.length,
      lessons: data.lessons.length, activityRecords: data.activityRecords.length, settings: data.settings.length };
    return wrap(FORMAT, data, { options: opts, counts });
  }
  async function buildSetsFile(setIds) {
    const sets = (await Promise.all(setIds.map((id) => HG.db.get('problemSets', id)))).filter(Boolean);
    const topicIds = new Set(sets.map((s) => s.topicId));
    const topics = (await HG.repo.topics()).filter((t) => topicIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, icon: t.icon, order: t.order, isBuiltIn: false, createdAt: t.createdAt, updatedAt: t.updatedAt }));
    const assetIds = new Set();
    sets.forEach((s) => s.words.forEach((w) => { if (w.image && w.image.kind === 'asset') assetIds.add(w.image.ref); }));
    const assets = (await Promise.all(Array.from(assetIds).map((id) => HG.db.get('assets', id)))).filter(Boolean);
    const plain = sets.map((s) => Object.assign(JSON.parse(JSON.stringify(s)), { isBuiltIn: false }));
    return wrap(SETS_FORMAT, { topics, problemSets: plain, assets: await Promise.all(assets.map(assetToJson)) });
  }
  function download(obj, filename) {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = HG.dom.h('a', { href: u, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  }
  async function saveBackup(opts) {
    const obj = await buildBackup(opts);
    const name = '한글교실_백업_' + HG.format.stamp() + '.json';
    download(obj, name);
    await HG.repo.setMeta('lastBackupAt', HG.format.nowISO());
    return { name, counts: obj.counts };
  }

  // ---------- 가져오기 검사 ----------
  function readText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsText(file, 'utf-8');
    });
  }
  /** 문자열 → 검사된 파일 객체. 실패 시 {ok:false, error} */
  async function parse(text, expectFormat) {
    let obj;
    try {
      obj = JSON.parse(text, (k, v) => { if (FORBIDDEN.includes(k)) throw new Error('FORBIDDEN'); return v; });
    } catch (e) {
      if (e.message === 'FORBIDDEN') return { ok: false, error: '파일에 허용되지 않는 내용이 있어 가져올 수 없습니다.' };
      return { ok: false, error: '이 파일은 한글 교실 백업 파일이 아닙니다. (JSON 형식이 아님)' };
    }
    if (!obj || typeof obj !== 'object' || ![FORMAT, SETS_FORMAT].includes(obj.format) || !obj.data || typeof obj.data !== 'object') {
      return { ok: false, error: '이 파일은 한글 교실 백업 파일이 아닙니다.' };
    }
    if (expectFormat && obj.format !== expectFormat) {
      return { ok: false, error: expectFormat === FORMAT ? '세트 공유 파일입니다. [세트 파일 가져오기]를 사용해 주세요.' : '전체 백업 파일입니다. [백업에서 복원]을 사용해 주세요.' };
    }
    const v = obj.schemaVersion;
    if (!Number.isInteger(v) || v < 0) return { ok: false, error: '백업 파일의 버전 정보가 올바르지 않습니다.' };
    if (v > HG.db.SCHEMA_VERSION) return { ok: false, error: '더 새 버전 앱에서 만든 백업입니다. 앱을 업데이트한 뒤 다시 시도해 주세요.' };
    if (!obj.checksum || typeof obj.checksum.value !== 'string') return { ok: false, error: '파일이 손상되었거나 수정되었습니다. 복원을 중단합니다.' };
    const sum = await HG.hash.sha256Hex(JSON.stringify(obj.data));
    if (sum !== obj.checksum.value) return { ok: false, error: '파일이 손상되었거나 수정되었습니다. 복원을 중단합니다.' };
    for (let n = v + 1; n <= HG.db.SCHEMA_VERSION; n++) if (migrations[n]) obj = migrations[n](obj);
    return checkContents(obj);
  }
  async function readFile(file, expectFormat) {
    if (!file) return { ok: false, error: '파일을 골라 주세요.' };
    if (file.size > MAX_FILE) return { ok: false, error: '파일이 너무 큽니다(200MB 초과). 이미지 제외 백업을 사용해 주세요.' };
    let text;
    try { text = await readText(file); } catch (e) { return { ok: false, error: '파일을 읽지 못했습니다.' }; }
    return parse(text, expectFormat);
  }
  function arr(v) { return Array.isArray(v) ? v : []; }
  /** 엔터티 정리 + 검증. 위반이 하나라도 있으면 전체 중단 */
  function checkContents(obj) {
    const d = obj.data;
    const problems = [];
    const topics = arr(d.topics).map(cleanTopic);
    const builtinTopicIds = HG.seed.TOPICS.map((t) => t.id);
    const topicIds = builtinTopicIds.concat(topics.map((t) => t.id));
    topics.forEach((t) => { if (!t.id) problems.push('주제 id 없음'); const r = V.topic(t, []); r.errors.forEach((e) => problems.push('주제 ' + (t.name || '?') + ': ' + e.msg)); });
    const sets = arr(d.problemSets).map(cleanSet);
    sets.forEach((s) => {
      if (!s.id) problems.push('세트 id 없음');
      V.problemSet(s, { topicIds }).errors.forEach((e) => problems.push("세트 '" + (s.title || '?') + "': " + e.msg));
    });
    const assets = arr(d.assets).map((a) => ({ id: str(a.id), label: str(a.label), mime: a.mime, width: int(a.width, 0), height: int(a.height, 0),
      size: int(a.size, 0), sha256: str(a.sha256), dataBase64: typeof a.dataBase64 === 'string' ? a.dataBase64 : '', createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt) }));
    assets.forEach((a) => {
      if (!a.id || !a.dataBase64 || !HG.images.TYPES.includes(a.mime)) problems.push('그림 ' + (a.label || '?') + ': 형식이 올바르지 않습니다');
      else if (!/^[A-Za-z0-9+/=]+$/.test(a.dataBase64)) problems.push('그림 ' + (a.label || '?') + ': 데이터가 손상되었습니다');
      const l = V.len(a.label);
      if (l < 1 || l > 30) problems.push('그림 이름표는 1~30자여야 합니다');
    });
    const lessons = arr(d.lessons).map(cleanLesson);
    lessons.forEach((l) => {
      if (!l.id) problems.push('수업 계획 id 없음');
      if (!HG.format.isValidYmd(l.date) || V.len(l.title) < 1 || V.len(l.title) > 30 || !V.LEVELS.includes(l.level)) problems.push("수업 계획 '" + (l.title || '?') + "': 내용이 올바르지 않습니다");
    });
    const records = arr(d.activityRecords).map(cleanRecord);
    records.forEach((r) => { if (!r.id || !V.ACTS.includes(r.activity)) problems.push('활동 기록 형식이 올바르지 않습니다'); });
    const settings = arr(d.settings).filter((r) => r && typeof r.key === 'string' && !NO_BACKUP_SETTINGS.includes(r.key) && HG.repo.validSetting(r.key, r.value))
      .map((r) => ({ key: r.key, value: r.value }));
    const builtInState = arr(d.builtInState).filter((x) => x && typeof x.id === 'string').map((x) => ({ id: x.id, isHidden: x.isHidden === true }));
    const builtInTopics = arr(d.builtInTopics).filter((x) => x && builtinTopicIds.includes(x.id))
      .map((x) => ({ id: x.id, name: str(x.name), order: int(x.order, 0), icon: HG.labels.topicIcons.includes(x.icon) ? x.icon : null }));
    if (problems.length) return { ok: false, error: '백업 파일에 올바르지 않은 내용이 ' + problems.length + '건 있어 복원을 중단합니다.', problems };
    return {
      ok: true, format: obj.format, exportedAt: obj.exportedAt, schemaVersion: obj.schemaVersion,
      data: { topics, problemSets: sets, assets, lessons, activityRecords: records, settings, builtInState, builtInTopics },
      counts: { topics: topics.length, problemSets: sets.length, assets: assets.length, lessons: lessons.length, activityRecords: records.length }
    };
  }

  // ---------- 적용 ----------
  function assetFromJson(a) {
    return { id: a.id, label: a.label, mime: a.mime, width: a.width, height: a.height, size: a.size, sha256: a.sha256,
      blob: base64ToBlob(a.dataBase64, a.mime), createdAt: a.createdAt, updatedAt: a.updatedAt };
  }
  function remapAssets(sets, map) {
    sets.forEach((s) => s.words.forEach((w) => { if (w.image && w.image.kind === 'asset' && map[w.image.ref]) w.image.ref = map[w.image.ref]; }));
  }
  /** 전체 교체 또는 병합 복원 — 단일 트랜잭션 */
  async function restore(parsed, mode) {
    const d = parsed.data;
    const cur = {};
    for (const s of ['topics', 'problemSets', 'assets', 'lessons', 'activityRecords']) cur[s] = await HG.db.getAll(s);
    const curAssetBySha = {};
    cur.assets.forEach((a) => { curAssetBySha[a.sha256] = a.id; });
    const incomingAssets = d.assets.map(assetFromJson);
    const assetMap = {};
    let putAssets = incomingAssets;
    let topics = d.topics, sets = d.problemSets.map((s) => Object.assign({}, s));

    if (mode === 'merge') {
      // 같은 sha256 이미지는 기존 것으로 통합
      putAssets = [];
      incomingAssets.forEach((a) => {
        if (curAssetBySha[a.sha256]) assetMap[a.id] = curAssetBySha[a.sha256];
        else putAssets.push(a);
      });
      // 이름 같은 주제는 기존 주제로 매핑
      const byName = {};
      cur.topics.forEach((t) => { byName[t.name] = t.id; });
      const topicMap = {};
      topics = topics.filter((t) => {
        if (byName[t.name] && byName[t.name] !== t.id) { topicMap[t.id] = byName[t.name]; return false; }
        return true;
      });
      sets.forEach((s) => { if (topicMap[s.topicId]) s.topicId = topicMap[s.topicId]; });
    }
    remapAssets(sets, assetMap);
    const curById = (list) => { const m = {}; list.forEach((x) => { m[x.id] = x; }); return m; };
    const newer = (store, list) => {
      if (mode !== 'merge') return list;
      const m = curById(cur[store]);
      return list.filter((x) => !m[x.id] || m[x.id].isBuiltIn !== true && (x.updatedAt || '') >= (m[x.id].updatedAt || ''));
    };
    await HG.db.write(['topics', 'problemSets', 'assets', 'lessons', 'activityRecords', 'settings', 'meta'], (tx) => {
      const os = (n) => tx.objectStore(n);
      if (mode !== 'merge') {
        cur.topics.filter((t) => !t.isBuiltIn).forEach((t) => os('topics').delete(t.id));
        cur.problemSets.filter((s) => !s.isBuiltIn).forEach((s) => os('problemSets').delete(s.id));
        ['assets', 'lessons', 'activityRecords'].forEach((n) => os(n).clear());
      }
      newer('topics', topics).forEach((t) => os('topics').put(t));
      newer('problemSets', sets).forEach((s) => os('problemSets').put(s));
      putAssets.forEach((a) => os('assets').put(a));
      newer('lessons', d.lessons).forEach((l) => os('lessons').put(l));
      newer('activityRecords', d.activityRecords).forEach((r) => os('activityRecords').put(r));
      if (mode !== 'merge') d.settings.forEach((r) => os('settings').put(r));
      const builtSets = curById(cur.problemSets);
      d.builtInState.forEach((b) => { const s = builtSets[b.id]; if (s && s.isBuiltIn) os('problemSets').put(Object.assign({}, s, { isHidden: b.isHidden })); });
      if (mode !== 'merge') {
        const builtTopics = curById(cur.topics);
        d.builtInTopics.forEach((b) => { const t = builtTopics[b.id]; if (t) os('topics').put(Object.assign({}, t, { name: b.name || t.name, order: b.order, icon: b.icon || t.icon })); });
      }
      os('meta').put({ key: 'lastRestoreAt', value: HG.format.nowISO() });
    });
    HG.images.forgetAll();
    await HG.repo.loadSettings();
    HG.events.emit('settings', {});
    return parsed.counts;
  }
  /** 세트 파일 가져오기: 항상 새 id, 제목 중복 시 " (가져옴)" */
  async function importSets(parsed) {
    const d = parsed.data;
    const cur = { topics: await HG.repo.topics(), sets: await HG.repo.sets(), assets: await HG.db.getAll('assets') };
    const curSha = {}; cur.assets.forEach((a) => { curSha[a.sha256] = a.id; });
    const assetMap = {}, putAssets = [];
    d.assets.map(assetFromJson).forEach((a) => {
      if (curSha[a.sha256]) assetMap[a.id] = curSha[a.sha256];
      else { const nid = HG.ids.uuid(); assetMap[a.id] = nid; curSha[a.sha256] = nid; putAssets.push(Object.assign(a, { id: nid })); }
    });
    const topicMap = {}, putTopics = [];
    const builtIds = HG.seed.TOPICS.map((t) => t.id);
    d.topics.forEach((t) => {
      if (builtIds.includes(t.id)) { topicMap[t.id] = t.id; return; }
      const same = cur.topics.find((x) => x.name === t.name);
      if (same) topicMap[t.id] = same.id;
      else { const nid = HG.ids.uuid(); topicMap[t.id] = nid; putTopics.push(Object.assign({}, t, { id: nid, order: cur.topics.length + putTopics.length })); }
    });
    const titles = new Set(cur.sets.map((s) => s.title));
    const now = HG.format.nowISO();
    const putSets = d.problemSets.map((s) => {
      let title = s.title;
      if (titles.has(title)) title = (title.slice(0, 24) + ' (가져옴)');
      titles.add(title);
      const ns = Object.assign({}, s, { id: HG.ids.uuid(), title, topicId: topicMap[s.topicId] || s.topicId, sourceSetId: s.id, isBuiltIn: false, isHidden: false, createdAt: now, updatedAt: now });
      remapAssets([ns], assetMap);
      return ns;
    });
    await HG.db.write(['topics', 'problemSets', 'assets'], (tx) => {
      putTopics.forEach((t) => tx.objectStore('topics').put(t));
      putAssets.forEach((a) => tx.objectStore('assets').put(a));
      putSets.forEach((s) => tx.objectStore('problemSets').put(s));
    });
    return { sets: putSets.length, assets: putAssets.length, topics: putTopics.length };
  }
  /** 모든 데이터 지우기 후 시드 재설치 */
  async function wipeAll() {
    await HG.db.write(HG.db.STORES, (tx) => HG.db.STORES.forEach((s) => tx.objectStore(s).clear()));
    HG.images.forgetAll();
    await HG.seed.install(true);
    await HG.repo.setMeta('installedAt', HG.format.nowISO());
    await HG.repo.loadSettings();
    HG.events.emit('settings', {});
  }
  HG.backup = { FORMAT, SETS_FORMAT, MAX_FILE, migrations, buildBackup, buildSetsFile, download, saveBackup, readFile, parse, restore, importSets, wipeAll, cleanSet };
})();
