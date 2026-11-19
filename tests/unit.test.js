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
      const s = HG.seed.SETS.find((x) => x.id === 'seed-anthem-1');
      assert.eq(s.kind, 'dictation');
      assert.eq(s.sentences.length, 10);
      assert.eq(s.sentences.map((x) => x.text).join(' '), '동해 물과 백두산이 마르고 닳도록 하느님이 보우하사 우리나라 만세 무궁화 삼천리 화려 강산 대한 사람 대한으로 길이 보전하세');
    });
    it('설치 후 받아쓰기 세트만 목록에 나옴', async () => {
      await HG.db.put('problemSets', { id: 'old-set', title: '이전 자료', words: [], sentences: [] });
      const list = await HG.seed.dictationSets();
      assert.eq(list.length, 11);
      assert.ok(!list.some((s) => s.id === 'old-set' || s.id === 'seed-woorimal-2'));
    });
    it('이전 버전의 10문장 묶음(seed-woorimal-2)은 설치 때 지워짐', async () => {
      await HG.db.put('problemSets', { id: 'seed-woorimal-2', kind: 'dictation', title: '옛 묶음', sentences: [] });
      await HG.seed.install(true);
      assert.eq(await HG.db.get('problemSets', 'seed-woorimal-2'), undefined);
    });
    it('재설치해도 중복 없음', async () => {
      await HG.seed.install(true); await HG.seed.install(true);
      assert.eq((await HG.seed.dictationSets()).length, 11);
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
    it('애국가 문장은 한 줄(10칸 이하)', () => HG.seed.SETS.find((x) => x.id === 'seed-anthem-1').sentences.forEach((x) => assert.ok(HG.activities.dictation.cells(x.text).length <= 10, x.text)));
    it('우리말 우리글 86~95번은 번호마다 한 문제(한 문장)씩', async () => {
      const g = (await HG.seed.dictationGroups()).find((x) => x.name === '2. 우리말 우리글');
      assert.eq(g.sets.map((s) => s.title), ['86번', '87번', '88번', '89번', '90번', '91번', '92번', '93번', '94번', '95번']);
      assert.ok(g.sets.every((s) => s.sentences.length === 1));
      assert.eq(g.sets[1].sentences[0].text, '혀가 윗잇몸에 닿는 모양');
      assert.eq(HG.activities.dictation.rowsOf(HG.activities.dictation.cells('네 몫의 뱃삯을 가져오너라.').length), [8, 7]);
    });
    it('문장부호도 한 칸', () => assert.eq(HG.activities.dictation.cells('좋니?'), ['좋', '니', '?']));
  });

  describe('읽어 주기', () => {
    it('친근한 목소리 자동 선택: 이 컴퓨터의 자연스러운 음성 우선, 설정에서 고른 음성 존중', async () => {
      const fake = [
        { name: 'Microsoft Heami - Korean', lang: 'ko-KR', localService: true },
        { name: 'Microsoft SunHi Online (Natural) - Korean', lang: 'ko-KR', localService: false },
        { name: 'Microsoft SunHi (Natural) - Korean', lang: 'ko-KR', localService: true },
        { name: 'English', lang: 'en-US', localService: true }
      ];
      const orig = speechSynthesis.getVoices;
      speechSynthesis.getVoices = () => fake;
      const before = HG.state.settings.ttsVoice;
      HG.state.settings.ttsVoice = '';
      assert.eq(HG.tts.pick().name, 'Microsoft SunHi (Natural) - Korean');
      assert.eq(HG.tts.koreanVoices().length, 3);
      HG.state.settings.ttsVoice = 'Microsoft Heami - Korean';
      assert.eq(HG.tts.pick().name, 'Microsoft Heami - Korean');
      HG.state.settings.ttsVoice = '없는 음성';
      assert.eq(HG.tts.pick().name, 'Microsoft SunHi (Natural) - Korean');
      HG.state.settings.ttsVoice = before;
      speechSynthesis.getVoices = orig;
      HG.tts.pick();
    });
    it('목소리 높낮이(기본 110%)가 읽기에 적용됨', () => {
      let got = null;
      const orig = speechSynthesis.speak;
      speechSynthesis.speak = (u) => { got = u.pitch; };
      HG.tts.speak('시험');
      speechSynthesis.speak = orig;
      assert.near(got, 1.1, 0.01);
      assert.ok(!HG.repo.validSetting('ttsPitch', 2));
    });
    it('한 글자씩 읽기: 글자마다 따로, 띄어쓰기는 건너뛰고 칸 번호 알림', async () => {
      const spoken = [], idx = [];
      const orig = speechSynthesis.speak;
      speechSynthesis.speak = (u) => { spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); };
      await new Promise((res) => HG.tts.speakSyllables('동해 물과', { gap: 5, wordGap: 10, onIndex: (i) => idx.push(i), onend: res }));
      speechSynthesis.speak = orig;
      assert.eq(spoken, ['동', '해', '물', '과']);
      assert.eq(idx, [0, 1, 3, 4, -1]);
    });
    it('한 글자씩 읽기: 문장부호는 읽지 않음', async () => {
      const spoken = [];
      const orig = speechSynthesis.speak;
      speechSynthesis.speak = (u) => { spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); };
      await new Promise((res) => HG.tts.speakSyllables('좋니?', { gap: 5, wordGap: 10, onend: res }));
      speechSynthesis.speak = orig;
      assert.eq(spoken, ['좋', '니']);
    });
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

  describe('정답 비교', () => {
    it('설정 기본값: 흐린 글씨 없음, 자동 판정 설정 없음', () => {
      const d = HG.repo.defaults();
      assert.eq(d.dictGuide, 'off');
      assert.ok(!('dictJudge' in d) && !('dictMinPct' in d));
      assert.ok(!HG.repo.validSetting('dictGuide', 'after'));
    });
    it('자동 판정 모듈을 쓰지 않음', () => assert.eq(typeof HG.hw, 'undefined'));
  });

  describe('해시', () => {
    it('SHA-256 JS 폴백 표준값', () => assert.eq(HG.hash.sha256js('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
    it('한글 입력이 Web Crypto와 일치', async () => { const t = '받아쓰기'.repeat(30); assert.eq(HG.hash.sha256js(t), await HG.hash.sha256Hex(t)); });
  });
})();
