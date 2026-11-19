/* 단위 테스트 — DEVELOPMENT_PLAN.md §5.2 시나리오 ID 표기. 모든 값은 가상 데이터 */
(function () {
  'use strict';
  const H = HG.hangul, V = HG.validate, S = HG.scoring;
  const baseSet = () => JSON.parse(JSON.stringify(HG.seed.SETS[6])); // 장보기(초급)

  describe('한글', () => {
    it('T-H01 초성 추출', () => assert.eq(H.getChosung('배추'), 'ㅂㅊ'));
    it('T-H02 쌍자음·공백·숫자', () => {
      assert.eq(H.getChosung('까치'), 'ㄲㅊ');
      assert.eq(H.getChosung('안부 전화'), 'ㅇㅂ ㅈㅎ');
      assert.eq(H.getChosung('3번 출구'), '3ㅂ ㅊㄱ');
    });
    it('T-H03 NFD 입력 정규화', () => assert.eq(H.getChosung('배추'.normalize('NFD')), 'ㅂㅊ'));
    it('T-H04 받침 판정', () => { assert.eq(H.hasFinal('사과'), false); assert.eq(H.hasFinal('병원'), true); assert.eq(H.hasFinal('닭'), true); });
    it('음절 수(공백 제외)', () => assert.eq(H.syllableCount('전기 요금'), 4));
  });

  describe('검증', () => {
    it('내장 세트는 오류 없음 (V-05 등 전수 검사)', () => {
      HG.seed.SETS.forEach((s) => {
        const r = V.problemSet(s, { topicIds: HG.seed.TOPICS.map((t) => t.id) });
        assert.eq(r.errors, [], s.id);
      });
    });
    it('내장 세트 12개 이상, 주제 5개 × 수준 3개', () => {
      assert.ok(HG.seed.SETS.length >= 12);
      HG.seed.TOPICS.forEach((t) => HG.labels.levels.forEach((lv) => assert.ok(HG.seed.SETS.some((s) => s.topicId === t.id && s.level === lv), t.id + lv)));
    });
    it('모든 내장 세트에서 4개 활동 가능', () => {
      HG.seed.SETS.forEach((s) => { const a = V.availability(s); ['trace', 'chosung', 'match', 'blank'].forEach((k) => assert.ok(a[k], s.id + ' ' + k)); });
    });
    it('T-V01 제목 경계값 0/1/30/31자', () => {
      const t = (n) => { const s = baseSet(); s.title = '가'.repeat(n); return V.problemSet(s, {}).errors.some((e) => e.field === 'title'); };
      assert.eq([t(0), t(1), t(30), t(31)], [true, false, false, true]);
    });
    it('T-V02 정답 없음 / 2회 등장', () => {
      const s = baseSet();
      s.sentences[0].answer = '포도';
      assert.ok(V.problemSet(s, {}).errors.some((e) => e.field === 'sentences.0.answer' && e.msg.includes('없습니다')));
      s.sentences[0] = { id: 's1', text: '사과 사과 맛있어요.', answer: '사과', distractors: ['배', '감'], order: 0 };
      assert.ok(V.problemSet(s, {}).errors.some((e) => e.msg.includes('2번')));
    });
    it('T-V03 보기 중복', () => {
      const s = baseSet();
      s.sentences[0].distractors = ['사과', '사자'];
      assert.ok(V.problemSet(s, {}).errors.some((e) => e.field === 'sentences.0.distractors'));
      s.sentences[0].distractors = ['사자', '사자'];
      assert.ok(V.problemSet(s, {}).errors.some((e) => e.field === 'sentences.0.distractors'));
    });
    it('T-V04 낱말 수 3/4/20/21', () => {
      const t = (n) => { const s = baseSet(); s.words = Array.from({ length: n }, (_, i) => ({ id: 'w' + i, text: '낱말' + String.fromCharCode(0xAC00 + i), image: null, hint: '', order: i })); return V.problemSet(s, {}).errors.some((e) => e.field === 'words'); };
      assert.eq([t(3), t(4), t(20), t(21)], [true, false, false, true]);
    });
    it('T-V05 8음절 + 공백 통과, 9음절 오류', () => {
      const s = baseSet();
      s.words[0].text = '가나다라 마바사아';
      assert.eq(V.problemSet(s, {}).errors.filter((e) => e.field === 'words.0.text').length, 0);
      s.words[0].text = '가나다라마바사아자';
      assert.ok(V.problemSet(s, {}).errors.some((e) => e.field === 'words.0.text'));
    });
    it('V-07 받침 불일치 경고', () => {
      const s = baseSet();
      s.sentences[0].distractors = ['수박', '가구'];
      assert.ok(V.problemSet(s, {}).warnings.some((w) => w.field === 'sentences.0.distractors'));
    });
    it('V-10 수업 계획: 짝짓기 불가 세트', () => {
      const s = baseSet(); s.words.forEach((w) => { w.image = null; });
      const r = V.lesson({ date: '2026-11-20', title: '가상 수업', topicId: s.topicId, level: 'beginner', activityPlan: [{ order: 0, activity: 'match', problemSetId: s.id }], participantCount: null, memo: '' }, { setsById: { [s.id]: s } });
      assert.ok(r.errors.some((e) => e.field === 'activityPlan.0'));
    });
    it('V-12/13 인원·날짜', () => {
      const r = V.lesson({ date: '2026-02-30', title: '가상', topicId: 't', level: 'beginner', activityPlan: [], participantCount: 31, memo: '' }, {});
      assert.ok(r.errors.some((e) => e.field === 'date'));
      assert.ok(r.errors.some((e) => e.field === 'participantCount'));
    });
  });

  describe('개인정보 경고', () => {
    it('T-P01 전화번호 경고', () => { const r = HG.privacy.check('연락 010-1234-5678'); assert.ok(r.messages.length && !r.block); });
    it('T-P02 주민등록번호 형식 차단', () => assert.ok(HG.privacy.check('800101-1234567').block));
    it('T-P03 일반 문장은 경고 없음', () => {
      ['오늘 날씨가 좋아요', '버스 기사님께 인사해요.', '할머니 댁에 손자가 왔어요.', '지하철 3번 출구로 나와요.', '약은 식후 삼십 분에 드세요.'].forEach((t) => assert.eq(HG.privacy.check(t).messages, [], t));
      HG.seed.SETS.forEach((s) => s.sentences.forEach((x) => assert.eq(HG.privacy.check(x.text).messages, [], x.text)));
    });
    it('이메일·생년월일·호칭', () => {
      assert.ok(HG.privacy.check('a@b.kr').messages.length);
      assert.ok(HG.privacy.check('1950년 3월 2일').messages.length);
      assert.ok(HG.privacy.check('김가상 어르신').messages.length);
    });
  });

  describe('점수', () => {
    const items = (spec) => spec.map((r, i) => ({ itemId: 'i' + i, text: 't', attempts: 1, result: r }));
    it('T-S01 별 경계값 79/80, 49/50', () => {
      assert.eq([S.stars(79, true), S.stars(80, true), S.stars(49, true), S.stars(50, true)], [2, 3, 1, 2]);
      assert.eq([S.stars(69, true, 'trace'), S.stars(70, true, 'trace'), S.stars(39, true, 'trace'), S.stars(40, true, 'trace')], [2, 3, 1, 2]);
    });
    it('T-S02 전부 건너뛰면 별 0, completed false', () => {
      const r = S.buildRecord({ items: items(['skipped', 'skipped']), activity: 'chosung', set: baseSet(), startedAt: new Date().toISOString() });
      assert.eq([r.stars, r.completed, r.score], [0, false, 0]);
    });
    it('T-S03 혼합 점수 84 → 별 3', () => {
      const r = S.buildRecord({ items: items(['first', 'first', 'first', 'first', 'first', 'retry', 'retry', 'revealed']), activity: 'blank', set: baseSet(), startedAt: new Date().toISOString() });
      assert.eq([r.score, r.stars], [84, 3]);
      assert.eq(r.correctFirstTry + r.correctAfterRetry + r.revealed + r.skipped, r.totalQuestions);
    });
    it('따라쓰기 점수', () => {
      assert.eq(S.traceLetterScore(0.9, 0.1), 85);
      assert.eq(S.traceLetterScore(0, 1), 0);
    });
    it('기록에 개인 식별 필드 없음', () => {
      const r = S.buildRecord({ items: items(['first']), activity: 'chosung', set: baseSet(), startedAt: new Date().toISOString() });
      ['name', 'learner', 'student', 'seat', 'turn', 'phone'].forEach((k) => assert.ok(!(k in r), k));
    });
  });

  describe('활동 계산', () => {
    const grid = (w, h, fn) => { const a = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = fn(x, y) ? 1 : 0; return a; };
    it('T-S04 완전 덧쓰기 coverage ≥ 0.9', () => {
      const g = grid(20, 20, (x, y) => x === 10);
      const r = HG.activities.trace.coverageFromMasks(g, grid(20, 20, (x) => x >= 9 && x <= 11), g, 20, 20, [[0, 20]]);
      assert.ok(r.coverage >= 0.9); assert.eq(r.outside, 0);
    });
    it('T-S05 빈 칸 0 / 칸 밖 낙서 outside 1', () => {
      const g = grid(20, 20, (x) => x === 10), t = grid(20, 20, (x) => x >= 9 && x <= 11);
      assert.eq(HG.activities.trace.coverageFromMasks(g, t, new Uint8Array(400), 20, 20, [[0, 20]]).coverage, 0);
      const r = HG.activities.trace.coverageFromMasks(g, t, grid(20, 20, (x) => x < 3), 20, 20, [[0, 20]]);
      assert.eq([r.coverage, r.outside], [0, 1]);
    });
    it('T-A04 5글자 낱말은 4+1칸으로 나눔', () => assert.eq(HG.activities.trace.chunks('현금인출기').map((c) => c.length), [4, 1]));
    it('빈칸 문장 나누기', () => {
      assert.eq(HG.activities.blank.split('시장에서 사과를 샀어요.', '사과'), ['시장에서 ', '사과', '를 샀어요.']);
      assert.eq(HG.activities.blank.split('사과가 좋아요', '사과')[0], '');
    });
    it('짝짓기 묶음: 8개 → 3·3·2, 4개(3쌍) → 4', () => {
      const w = (n) => Array.from({ length: n }, (_, i) => ({ id: 'w' + i }));
      assert.eq(HG.activities.match.rounds(w(8), 3).map((r) => r.length), [3, 3, 2]);
      assert.eq(HG.activities.match.rounds(w(4), 3).map((r) => r.length), [4]);
    });
    it('초성 오답 보기: 초성 같은 낱말 제외, 중복 없음', () => {
      const pool = ['사과', '수건', '배추', '버스', '나무'].map((t) => ({ text: t, sameSet: true }));
      for (let k = 0; k < 20; k++) {
        const d = HG.act.pickDistractors('사과', pool, 2);
        assert.eq(d.length, 2);
        assert.ok(!d.includes('사과') && !d.includes('수건'));
        assert.eq(new Set(d).size, 2);
      }
    });
  });

  describe('해시·통계', () => {
    it('SHA-256 JS 폴백이 표준값과 일치', () => assert.eq(HG.hash.sha256js('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
    it('SHA-256 한글(UTF-8)·긴 입력이 Web Crypto와 일치', async () => {
      const t = '한글 교실'.repeat(40);
      assert.eq(HG.hash.sha256js(t), await HG.hash.sha256Hex(t));
    });
    it('통계 집계 (가상 기록)', () => {
      const rec = (a, f, r, rev, sk, items, iso) => ({ activity: a, startedAt: iso, topicId: 'topic-market', level: 'beginner', totalQuestions: f + r + rev + sk, correctFirstTry: f, correctAfterRetry: r, revealed: rev, skipped: sk, stars: 2, avgCoverage: a === 'trace' ? 0.5 : null, itemResults: items });
      const it3 = (text, res) => res.map((x) => ({ text, result: x }));
      const now = new Date(2026, 10, 19, 10).toISOString();
      const recs = [
        rec('chosung', 2, 1, 1, 0, it3('사과', ['first', 'retry']).concat(it3('배추', ['revealed', 'first'])), now),
        rec('blank', 1, 0, 0, 1, it3('사과', ['retry', 'skipped']), now),
        rec('trace', 1, 0, 0, 0, [], now),
        rec('chosung', 1, 0, 0, 0, [], new Date(2025, 0, 1).toISOString())
      ];
      const rg = HG.screens.stats.range({ period: 'month' }, new Date(2026, 10, 19));
      const r = HG.screens.stats.compute(recs, [{ status: 'done', date: '2026-11-18', topicId: 'topic-market', level: 'beginner' }], {}, rg);
      assert.eq([r.lessons, r.activities, r.stars], [1, 3, 6]);
      assert.near(r.accuracy, 4 / 5, 1e-9, '정답률');
      assert.eq(r.hard.map((w) => w.text), ['사과']);
      assert.near(r.traceCoverage, 0.5, 1e-9);
    });
    it('통계 기간 오류', () => {
      assert.ok(HG.screens.stats.range({ period: 'custom', from: '2026-11-10', to: '2026-11-01' }).error);
      assert.ok(HG.screens.stats.range({ period: 'custom', from: '2025-01-01', to: '2026-11-01' }).capped);
    });
  });
})();
