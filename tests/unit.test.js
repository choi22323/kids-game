/* 단위 테스트 — 받아쓰기 프로그램. 모든 값은 가상 데이터 */
(function () {
  'use strict';
  const H = HG.hangul, S = HG.scoring;
  const item = (r) => ({ itemId: 'i', text: 't', attempts: 1, result: r });

  describe('한글', () => {
    it('초성 추출(쌍자음·공백·숫자)', () => {
      assert.eq(H.getChosung('배추'), 'ㅂㅊ');
      assert.eq(H.getChosung('안부 전화'), 'ㅇㅂ ㅈㅎ');
      assert.eq(H.getChosung('3번 출구'), '3ㅂ ㅊㄱ');
    });
    it('NFD 입력 정규화', () => assert.eq(H.getChosung('배추'.normalize('NFD')), 'ㅂㅊ'));
    it('받침 판정', () => { assert.eq(H.hasFinal('사과'), false); assert.eq(H.hasFinal('병원'), true); });
  });

  describe('받아쓰기 자료', () => {
    it('애국가 1절 시험용 10문장', () => {
      const s = HG.seed.SETS[0];
      assert.eq(s.kind, 'dictation');
      assert.eq(s.sentences.length, 10);
      assert.eq(s.sentences.map((x) => x.text).join(' '), '동해 물과 백두산이 마르고 닳도록 하느님이 보우하사 우리나라 만세 무궁화 삼천리 화려 강산 대한 사람 대한으로 길이 보전하세');
    });
    it('설치 후 받아쓰기 세트만 목록에 나옴', async () => {
      await HG.db.put('problemSets', { id: 'old-set', title: '이전 자료', words: [], sentences: [] });
      const list = await HG.seed.dictationSets();
      assert.eq(list.map((s) => s.id), ['seed-anthem-1']);
    });
    it('재설치해도 중복 없음', async () => {
      await HG.seed.install(true); await HG.seed.install(true);
      assert.eq((await HG.seed.dictationSets()).length, 1);
    });
  });

  describe('받아쓰기 칸', () => {
    it('띄어쓰기도 한 칸', () => assert.eq(HG.activities.dictation.cells('동해 물과'), ['동', '해', ' ', '물', '과']));
    it('앞뒤 공백 제거', () => assert.eq(HG.activities.dictation.cells(' 대한 ').length, 2));
    it('10칸 이하는 한 줄, 넘으면 두 줄', () => {
      assert.eq(HG.activities.dictation.rowsOf(9), [9]);
      assert.eq(HG.activities.dictation.rowsOf(14), [7, 7]);
      assert.eq(HG.activities.dictation.rowsOf(13), [7, 6]);
    });
    it('시험용 문장은 모두 한 줄(10칸 이하)', () => HG.seed.SETS[0].sentences.forEach((x) => assert.ok(HG.activities.dictation.cells(x.text).length <= 10, x.text)));
  });

  describe('읽어 주기', () => {
    it('음성이 없어도 오류 없이 false/true 반환', () => {
      const r = HG.tts.speak('시험', { onend: () => {} });
      assert.ok(typeof r === 'boolean');
      HG.tts.stop();
    });
    it('읽기 속도 설정 범위', () => {
      assert.ok(HG.repo.validSetting('ttsRate', 0.85));
      assert.ok(!HG.repo.validSetting('ttsRate', 2));
      assert.ok(!HG.repo.validSetting('ttsRate', 0.3));
    });
  });

  describe('점수', () => {
    it('모두 받아 쓰면 100점·별 3, 모두 건너뛰면 별 0', () => {
      const set = HG.seed.SETS[0];
      const all = S.buildRecord({ items: Array(10).fill(0).map(() => item('first')), activity: 'dictation', set, startedAt: new Date().toISOString() });
      assert.eq([all.score, all.stars], [100, 3]);
      const none = S.buildRecord({ items: Array(3).fill(0).map(() => item('skipped')), activity: 'dictation', set, startedAt: new Date().toISOString() });
      assert.eq([none.stars, none.completed], [0, false]);
    });
    it('별 경계값 79/80, 49/50', () => assert.eq([S.stars(79, true), S.stars(80, true), S.stars(49, true), S.stars(50, true)], [2, 3, 1, 2]));
    it('기록에 개인 식별 필드·필기 데이터 없음', () => {
      const r = S.buildRecord({ items: [item('first')], activity: 'dictation', set: HG.seed.SETS[0], startedAt: new Date().toISOString() });
      ['name', 'learner', 'student', 'seat', 'strokes', 'image'].forEach((k) => assert.ok(!(k in r), k));
    });
  });

  describe('정답 판정', () => {
    const canvas = (draw) => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const x = c.getContext('2d'); x.lineWidth = 14; x.lineCap = 'round'; if (draw) draw(x); return c; };
    it('헷갈리는 글자 후보에 정답 포함, 중복 없음', () => {
      const c = HG.hw.candidates('물');
      assert.ok(c.includes('물') && c.includes('불') && c.includes('밀') && c.includes('무'));
      assert.eq(new Set(c).size, c.length);
    });
    it('빈 칸은 틀림', () => assert.eq(HG.hw.judgeBox(canvas(), { x: 0, y: 0, size: 200, ch: '물' }).reason, 'empty'));
    it('띄어쓰기 칸: 비어 있으면 맞음, 글씨가 있으면 틀림', () => {
      assert.ok(HG.hw.judgeBox(canvas(), { x: 0, y: 0, size: 200, ch: ' ' }).ok);
      const r = HG.hw.judgeBox(canvas((x) => { x.beginPath(); x.moveTo(40, 100); x.lineTo(160, 100); x.stroke(); }), { x: 0, y: 0, size: 200, ch: ' ' });
      assert.eq([r.ok, r.reason], [false, 'space']);
    });
    it('가로줄 하나는 "물"로 인정하지 않음', () => {
      const r = HG.hw.judgeBox(canvas((x) => { x.beginPath(); x.moveTo(30, 100); x.lineTo(170, 100); x.stroke(); }), { x: 0, y: 0, size: 200, ch: '물' });
      assert.ok(!r.ok);
    });
    it('설정 기본값: 흐린 글씨 없음, 자동 판정 켜짐, 엄격하게', () => {
      const d = HG.repo.defaults();
      assert.eq([d.dictGuide, d.dictJudge, d.dictStrict], ['off', true, 'strict']);
    });
    it('틀림 결과는 별 계산에 참여 점수로 반영', () => {
      const r = S.buildRecord({ items: [item('first'), item('wrong')], activity: 'dictation', set: HG.seed.SETS[0], startedAt: new Date().toISOString() });
      assert.eq([r.wrong, r.score], [1, 65]);
      assert.eq(r.correctFirstTry + r.correctAfterRetry + r.revealed + r.wrong + r.skipped, r.totalQuestions);
    });
  });

  describe('해시', () => {
    it('SHA-256 JS 폴백 표준값', () => assert.eq(HG.hash.sha256js('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
    it('한글 입력이 Web Crypto와 일치', async () => { const t = '받아쓰기'.repeat(30); assert.eq(HG.hash.sha256js(t), await HG.hash.sha256Hex(t)); });
  });
})();
