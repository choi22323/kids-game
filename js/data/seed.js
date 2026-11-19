/* 내장 샘플 데이터 (DATA_MODEL.md §6). 모두 가상 교육 자료이며 현장 강사 검수 필요(Q-05).
   그림은 1차로 이모지를 사용한다(Q-07). */
(function () {
  'use strict';
  const SEED_VERSION = 1;
  const T0 = '2026-11-19T00:00:00.000Z';

  const TOPICS = [
    { id: 'topic-family', name: '가족', icon: 'family' },
    { id: 'topic-health', name: '건강·병원', icon: 'health' },
    { id: 'topic-market', name: '시장·경제', icon: 'market' },
    { id: 'topic-seasons', name: '사계절', icon: 'seasons' },
    { id: 'topic-transport', name: '교통', icon: 'transport' }
  ].map((t, i) => Object.assign(t, { order: i, isBuiltIn: true, createdAt: T0, updatedAt: T0 }));

  /** "낱말:이모지, 낱말" 형식 → WordItem[] */
  function W(spec) {
    return spec.split(',').map((tok, i) => {
      const [text, emoji] = tok.split(':').map((s) => s && s.trim());
      return { id: 'w' + (i + 1), text, image: emoji ? { kind: 'emoji', ref: emoji, alt: text } : null, hint: '', order: i };
    });
  }
  /** [문장, 정답, 오답1, 오답2] → SentenceItem[] */
  function S(rows) {
    return rows.map(([text, answer, d1, d2], i) => ({ id: 's' + (i + 1), text, answer, distractors: [d1, d2], order: i }));
  }
  function set(topic, level, title, words, sentences, description) {
    return {
      id: 'seed-' + topic + '-' + level,
      title, topicId: 'topic-' + topic, level, description: description || '',
      isBuiltIn: true, isHidden: false,
      words: W(words), sentences: S(sentences),
      activityOptions: {
        trace: { enabled: true, gridStyle: 'cross', repeat: 1 },
        chosung: { enabled: true, optionCount: 3, showImageHint: true },
        match: { enabled: true, pairsPerRound: 3 },
        blank: { enabled: true }
      },
      tags: [], sourceSetId: null, createdAt: T0, updatedAt: T0
    };
  }

  const SETS = [
    set('family', 'beginner', '우리 가족 (초급)', '엄마:👩, 아빠:👨, 아기:👶, 누나, 오빠, 이모, 고모, 부부:💑', [
      ['아기가 방긋 웃어요.', '아기', '오이', '나무'],
      ['이모가 놀러 오셨어요.', '이모', '모자', '우유'],
      ['오빠와 누나는 사이가 좋아요.', '누나', '바다', '구두'],
      ['엄마가 밥을 지으세요.', '엄마', '거미', '하마']], '받침이 적은 가족 낱말'),
    set('family', 'intermediate', '정다운 우리 집 (중급)', '할머니:👵, 할아버지:👴, 아들, 딸, 손자:👦, 손녀:👧, 사위, 며느리', [
      ['할머니 댁에 손자가 왔어요.', '손자', '시장', '감기'],
      ['우리 딸이 전화를 했어요.', '딸', '떡', '달'],
      ['며느리가 반찬을 보내 주었어요.', '며느리', '미나리', '머리'],
      ['할아버지는 산책을 좋아하세요.', '산책', '신발', '선물']], '받침 있는 가족 낱말'),
    set('family', 'advanced', '가족 행사 (고급)', '가족사진:📷, 생일잔치:🎂, 결혼식:💒, 명절, 안부 전화:☎️, 손주, 돌잔치, 효도', [
      ['명절에 온 가족이 모였어요.', '명절', '병원', '영수증'],
      ['손주의 돌잔치에 다녀왔어요.', '돌잔치', '정류장', '김장'],
      ['주말마다 안부 전화를 해요.', '안부 전화', '전기 요금', '신호등'],
      ['벽에 가족사진을 걸었어요.', '가족사진', '처방전', '교통카드']], '가족 행사와 관련된 합성어'),

    set('health', 'beginner', '내 몸 (초급)', '머리, 다리:🦵, 허리, 이마, 코:👃, 귀:👂, 의사:🧑‍⚕️, 주사:💉', [
      ['머리가 아파요.', '머리', '바다', '오리'],
      ['의사 선생님을 만나요.', '의사', '이사', '우유'],
      ['허리를 쭉 펴요.', '허리', '오리', '보리'],
      ['주사를 맞았어요.', '주사', '주스', '가지']], '몸과 병원 기초 낱말'),
    set('health', 'intermediate', '병원에 가요 (중급)', '병원:🏥, 약국:💊, 감기:🤧, 혈압, 보건소, 간호사, 체온:🌡️, 진찰', [
      ['감기에 걸려서 병원에 갔어요.', '병원', '시장', '공원'],
      ['약국에서 약을 샀어요.', '약국', '학교', '극장'],
      ['보건소에서 혈압을 재요.', '혈압', '사과', '반찬'],
      ['간호사가 체온을 재 주었어요.', '체온', '차표', '계란']], '병원·약국 이용 낱말'),
    set('health', 'advanced', '건강 지키기 (고급)', '처방전:📝, 건강검진:🩺, 접수 창구, 복용법, 예방접종:💉, 진료비, 보호자, 식후', [
      ['의사 선생님이 처방전을 써 주셨어요.', '처방전', '영수증', '승차권'],
      ['올해 건강검진 날짜를 잡았어요.', '건강검진', '단풍놀이', '결혼식'],
      ['약은 식후 삼십 분에 드세요.', '식후', '입춘', '왕복'],
      ['독감 예방접종을 맞았어요.', '예방접종', '노약자석', '공과금']], '건강 관리 생활 낱말'),

    set('market', 'beginner', '장보기 (초급)', '사과:🍎, 배추:🥬, 무, 두부, 우유:🥛, 고구마:🍠, 바나나:🍌, 가지:🍆', [
      ['시장에서 사과를 샀어요.', '사과', '사자', '가구'],
      ['두부로 찌개를 끓여요.', '두부', '구두', '나비'],
      ['배추로 김치를 담가요.', '배추', '기차', '버스'],
      ['아침에 우유를 마셔요.', '우유', '오이', '나무']], '장보기 기초 낱말'),
    set('market', 'intermediate', '시장 구경 (중급)', '시장:🏪, 생선:🐟, 계란:🥚, 과일:🍇, 반찬, 거스름돈:🪙, 가격, 할인', [
      ['생선 가게에서 고등어를 샀어요.', '생선', '생일', '선물'],
      ['거스름돈을 받았어요.', '거스름돈', '정류장', '보건소'],
      ['오늘은 과일을 할인해요.', '할인', '환승', '진찰'],
      ['계란 한 판을 샀어요.', '계란', '기린', '계단']], '시장 이용 낱말'),
    set('market', 'advanced', '은행과 생활비 (고급)', '영수증:🧾, 통장:📒, 현금인출기:🏧, 적금, 공과금, 전기 요금:💡, 카드 결제:💳, 비밀번호:🔒', [
      ['물건을 사고 영수증을 받았어요.', '영수증', '처방전', '승차권'],
      ['은행에서 통장 정리를 했어요.', '통장', '단풍', '체온'],
      ['이번 달 전기 요금을 냈어요.', '전기 요금', '안부 전화', '하차 벨'],
      ['비밀번호는 남에게 알려 주지 않아요.', '비밀번호', '건강검진', '꽃샘추위']], '은행·생활비 낱말'),

    set('seasons', 'beginner', '자연과 날씨 (초급)', '나무:🌳, 바다:🌊, 비:🌧️, 해:☀️, 하늘, 나비:🦋, 개나리, 소나기', [
      ['개나리가 노랗게 피었어요.', '개나리', '미나리', '오리'],
      ['바다에 가요.', '바다', '바지', '다리'],
      ['소나기가 내려요.', '소나기', '소나무', '고기'],
      ['하늘이 파래요.', '하늘', '허리', '나무']], '자연·날씨 기초 낱말'),
    set('seasons', 'intermediate', '봄 여름 가을 겨울 (중급)', '봄:🌸, 여름, 가을:🍂, 겨울:❄️, 장마:☔, 단풍:🍁, 눈사람:⛄, 진달래', [
      ['봄에는 진달래가 피어요.', '진달래', '장마', '생선'],
      ['여름에는 장마가 와요.', '장마', '장미', '감자'],
      ['가을 산에 단풍이 들었어요.', '단풍', '단추', '반찬'],
      ['겨울에 눈사람을 만들어요.', '눈사람', '눈썹', '손수건']], '사계절 낱말'),
    set('seasons', 'advanced', '절기와 생활 (고급)', '꽃샘추위, 무더위:🥵, 김장:🥬, 입춘, 단풍놀이:🍁, 첫눈:🌨️, 일교차, 동지팥죽', [
      ['봄인데 꽃샘추위가 매서워요.', '꽃샘추위', '무더위', '첫눈'],
      ['온 동네가 모여 김장을 했어요.', '김장', '환승', '통장'],
      ['동짓날에는 동지팥죽을 먹어요.', '동지팥죽', '미역국', '떡국'],
      ['아침저녁 일교차가 커요.', '일교차', '일요일', '교차로']], '절기와 생활 풍습'),

    set('transport', 'beginner', '타고 다녀요 (초급)', '기차:🚆, 버스:🚌, 배:🚢, 비행기:✈️, 오토바이:🏍️, 자리:💺, 기사, 차표:🎫', [
      ['기차를 타고 고향에 가요.', '기차', '기자', '가지'],
      ['버스 기사님께 인사해요.', '기사', '가사', '기러기'],
      ['차표를 사요.', '차표', '주소', '치마'],
      ['빈 자리에 앉아요.', '자리', '자두', '우비']], '탈것 기초 낱말'),
    set('transport', 'intermediate', '길 찾기 (중급)', '정류장:🚏, 지하철:🚇, 택시:🚕, 신호등:🚦, 횡단보도, 교통카드:💳, 출구, 환승', [
      ['버스 정류장에서 기다려요.', '정류장', '정육점', '운동장'],
      ['초록불일 때 횡단보도를 건너요.', '횡단보도', '지하철', '거스름돈'],
      ['지하철 3번 출구로 나와요.', '출구', '축구', '친구'],
      ['택시를 불렀어요.', '택시', '탁자', '떡국']], '길 찾기 낱말'),
    set('transport', 'advanced', '안전한 외출 (고급)', '충전:🔋, 노약자석, 터미널, 승차권:🎟️, 하차 벨:🔔, 왕복, 도착 시간:⏰, 안전띠', [
      ['교통카드를 충전했어요.', '충전', '진찰', '출구'],
      ['노약자석을 양보해요.', '노약자석', '노래자랑', '일교차'],
      ['내릴 때 하차 벨을 눌러요.', '하차 벨', '승차권', '왕복'],
      ['차에 타면 안전띠를 매요.', '안전띠', '터미널', '영수증']], '대중교통 이용 낱말')
  ];

  /** 내장 데이터 설치/갱신: 사용자 데이터는 건드리지 않고, 숨김 상태와 주제 이름·순서는 보존 */
  async function install(force) {
    const cur = (await HG.repo.getMeta('seedVersion')) || 0;
    if (!force && cur >= SEED_VERSION) return false;
    const oldTopics = await HG.repo.topicsMap();
    const oldSets = await HG.repo.setsMap();
    await HG.db.write(['topics', 'problemSets', 'meta'], (tx) => {
      const ts = tx.objectStore('topics'), ps = tx.objectStore('problemSets'), ms = tx.objectStore('meta');
      TOPICS.forEach((t) => {
        const o = oldTopics[t.id];
        ts.put(Object.assign({}, t, o ? { name: o.name, order: o.order, icon: o.icon, updatedAt: o.updatedAt } : {}));
      });
      SETS.forEach((s) => {
        const o = oldSets[s.id];
        ps.put(Object.assign(JSON.parse(JSON.stringify(s)), { isHidden: o ? !!o.isHidden : false }));
      });
      ms.put({ key: 'seedVersion', value: SEED_VERSION });
    });
    return true;
  }
  HG.seed = { SEED_VERSION, TOPICS, SETS, install };
})();
