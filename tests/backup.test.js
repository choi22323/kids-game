/* 백업·복원 통합 테스트 (임시 DB) — DEVELOPMENT_PLAN.md §5.3. 모든 값은 가상 데이터 */
(function () {
  'use strict';
  const B = HG.backup;
  const T = () => new Date().toISOString();
  const strip = (x) => JSON.parse(JSON.stringify(x));
  async function snapshot() {
    const o = {};
    for (const s of ['topics', 'problemSets', 'lessons', 'activityRecords', 'settings']) o[s] = (await HG.db.getAll(s)).sort((a, b) => String(a.id || a.key).localeCompare(String(b.id || b.key)));
    o.assets = (await HG.db.getAll('assets')).map((a) => [a.id, a.label, a.sha256, a.size]).sort();
    return strip(o);
  }
  async function pngBlob(color) {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 8, 8);
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }
  async function addSample() {
    const blob = await pngBlob('#B8893A');
    const sha = await HG.hash.sha256Hex(await blob.arrayBuffer());
    await HG.db.put('assets', { id: 'a1', label: '가상 그림', mime: 'image/png', width: 8, height: 8, size: blob.size, sha256: sha, blob, createdAt: T(), updatedAt: T() });
    await HG.db.put('topics', { id: 'u-topic', name: '가상 주제', icon: 'book', order: 5, isBuiltIn: false, createdAt: T(), updatedAt: T() });
    for (let i = 1; i <= 3; i++) {
      const s = B.cleanSet(HG.seed.SETS[0]);
      Object.assign(s, { id: 'u-set-' + i, title: '가상 세트 ' + i, topicId: 'u-topic' });
      s.words[0].image = { kind: 'asset', ref: 'a1', alt: '가상 그림' };
      await HG.db.put('problemSets', s);
    }
    await HG.db.put('lessons', { id: 'l1', date: '2026-11-20', title: '가상 수업', topicId: 'u-topic', level: 'beginner', activityPlan: [{ order: 0, activity: 'trace', problemSetId: 'u-set-1' }], status: 'planned', participantCount: 9, memo: '', startedAt: null, endedAt: null, createdAt: T(), updatedAt: T() });
    for (let i = 0; i < 10; i++) {
      await HG.db.put('activityRecords', HG.scoring.buildRecord({ items: [{ itemId: 'w1', text: '엄마', attempts: 1, result: 'first' }], activity: 'chosung', set: HG.seed.SETS[0], lessonId: 'l1', startedAt: T() }));
    }
    const hidden = await HG.db.get('problemSets', 'seed-family-beginner');
    hidden.isHidden = true;
    await HG.db.put('problemSets', hidden);
    await HG.repo.setSetting('fontScale', 1.3);
  }
  const parse = (txt, fmt) => B.parse(txt, fmt);

  describe('백업·복원', () => {
    it('T-B01 백업 → 전체 지우기 → 전체 교체 복원 왕복 일치', async () => {
      await addSample();
      const before = await snapshot();
      const file = await B.buildBackup({});
      await B.wipeAll();
      assert.ok((await HG.db.getAll('assets')).length === 0);
      const r = await parse(JSON.stringify(file), B.FORMAT);
      assert.ok(r.ok, r.error);
      await B.restore(r, 'replace');
      const after = await snapshot();
      ['topics', 'problemSets', 'lessons', 'activityRecords', 'assets'].forEach((k) => assert.eq(after[k], before[k], k));
      assert.eq(HG.state.settings.fontScale, 1.3);
      assert.eq((await HG.db.get('problemSets', 'seed-family-beginner')).isHidden, true, '내장 세트 숨김 복원');
      const img = await HG.db.get('assets', 'a1');
      assert.ok(img.blob instanceof Blob && img.blob.size > 0, '이미지 Blob 복원');
    });
    it('T-B02 기록·그림 제외 옵션', async () => {
      const f = await B.buildBackup({ includeRecords: false, includeImages: false });
      assert.eq([f.data.activityRecords.length, f.data.assets.length, f.counts.activityRecords], [0, 0, 0]);
    });
    it('T-B13 PIN 해시는 백업에 없음', async () => {
      await HG.repo.setSetting('adminPinSalt', 'a'.repeat(32));
      await HG.repo.setSetting('adminPinHash', 'b'.repeat(64));
      const txt = JSON.stringify(await B.buildBackup({}));
      assert.ok(!txt.includes('adminPinHash') && !txt.includes('b'.repeat(64)));
      await HG.repo.setSetting('adminPinHash', null);
      await HG.repo.setSetting('adminPinSalt', null);
    });
    it('T-B03 병합: 더 최근 updatedAt 유지', async () => {
      const f = await B.buildBackup({});
      const s = f.data.problemSets.find((x) => x.id === 'u-set-1');
      s.title = '백업 쪽 최신'; s.updatedAt = '2099-01-01T00:00:00.000Z';
      const s2 = f.data.problemSets.find((x) => x.id === 'u-set-2');
      s2.title = '백업 쪽 예전'; s2.updatedAt = '2000-01-01T00:00:00.000Z';
      f.checksum.value = await HG.hash.sha256Hex(JSON.stringify(f.data));
      const r = await parse(JSON.stringify(f), B.FORMAT);
      await B.restore(r, 'merge');
      assert.eq((await HG.db.get('problemSets', 'u-set-1')).title, '백업 쪽 최신');
      assert.eq((await HG.db.get('problemSets', 'u-set-2')).title, '가상 세트 2');
      assert.eq((await HG.db.getAll('assets')).length, 1, '같은 그림은 하나로');
    });
    it('T-B04 세트 파일 가져오기 2회 → 새 id 2벌, 그림 중복 없음', async () => {
      const f = await B.buildSetsFile(['u-set-1']);
      const before = (await HG.db.getAll('problemSets')).length;
      for (let i = 0; i < 2; i++) { const r = await parse(JSON.stringify(f), B.SETS_FORMAT); assert.ok(r.ok, r.error); await B.importSets(r); }
      const all = await HG.db.getAll('problemSets');
      assert.eq(all.length, before + 2);
      assert.ok(all.filter((s) => s.sourceSetId === 'u-set-1').every((s) => s.title.includes('(가져옴)')));
      assert.eq((await HG.db.getAll('assets')).length, 1);
    });
    const unchanged = async (txt, fmt, expectWord) => {
      const before = await snapshot();
      const r = await parse(txt, fmt);
      assert.ok(!r.ok, '거부되어야 함');
      if (expectWord) assert.ok(r.error.includes(expectWord), r.error);
      assert.eq(await snapshot(), before, '기존 데이터 무변경');
      return r;
    };
    it('T-B05 JSON 아님 / 다른 형식 거부', async () => {
      await unchanged(FIXTURES.notJson, B.FORMAT, '백업 파일이 아닙니다');
      await unchanged(FIXTURES.other, B.FORMAT, '백업 파일이 아닙니다');
    });
    it('T-B06 체크섬 불일치 거부', async () => { await unchanged(FIXTURES.tampered, B.FORMAT, '손상'); });
    it('T-B07 상위 버전 거부', async () => { await unchanged(FIXTURES.future, B.FORMAT, '새 버전'); });
    it('T-B08 __proto__ 포함 파일 거부', async () => { await unchanged(FIXTURES.proto, B.FORMAT, '허용되지 않는'); assert.ok(!({}).polluted); });
    it('T-B09 검증 위반 레코드 → 실패 목록, 전체 중단', async () => {
      const r = await unchanged(FIXTURES.badRecord, B.FORMAT, '올바르지 않은');
      assert.ok(r.problems && r.problems.length >= 1);
    });
    it('T-B10 트랜잭션 중 오류 → 롤백', async () => {
      const before = await snapshot();
      let failed = false;
      try {
        await HG.db.write(['problemSets', 'lessons'], (tx) => {
          tx.objectStore('lessons').clear();
          tx.objectStore('problemSets').put({ noId: true }); // keyPath 없음 → DataError
        });
      } catch (e) { failed = true; }
      assert.ok(failed);
      assert.eq(await snapshot(), before);
    });
    it('T-B11 200MB 초과 파일 거부', async () => {
      const r = await B.readFile({ size: 201 * 1024 * 1024 }, B.FORMAT);
      assert.ok(!r.ok && r.error.includes('200MB'));
    });
    it('T-B12 구버전(v0) 백업 마이그레이션 후 복원', async () => {
      const r = await parse(FIXTURES.v0, B.FORMAT);
      assert.ok(r.ok, r.error);
      assert.eq(r.data.problemSets[0].id, 'fx-set-1');
    });
    it('정상 픽스처 통과', async () => { const r = await parse(FIXTURES.valid, B.FORMAT); assert.ok(r.ok, r.error); assert.eq(r.counts.problemSets, 1); });
    it('세트 파일을 전체 복원에 쓰면 안내', async () => {
      const f = await B.buildSetsFile(['u-set-1']);
      const r = await parse(JSON.stringify(f), B.FORMAT);
      assert.ok(!r.ok && r.error.includes('세트 파일 가져오기'));
    });
    it('F-18 시드 재설치는 중복 없이 사용자 세트 보존', async () => {
      const n = (await HG.db.getAll('problemSets')).length;
      await HG.seed.install(true);
      assert.eq((await HG.db.getAll('problemSets')).length, n);
    });
  });
})();
