/* 홈: 받아쓰기 문장 묶음 고르기 + 읽어 주기 음성 상태 */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui, F = HG.format;
  let offVoice = null;

  async function mount(view) {
    const [sets, recs] = await Promise.all([HG.seed.dictationSets(), HG.db.getAll('activityRecords')]);
    const week = recs.filter((r) => r.activity === 'dictation' && F.daysSince(r.startedAt) < 7);
    const scr = ui.screen('받아쓰기 교실', null, F.dateLabel(F.todayStr()) + ' · 최근 7일 받아쓰기 ' + week.length + '회');
    const list = h('div', { class: 'list' });
    const voiceCard = h('div', { class: 'card voice-card' });
    scr.body.appendChild(h('div', { class: 'split' }, h('div', { class: 'split-main' }, h('p', { class: 'lead', text: '받아 쓸 문장 묶음을 골라 주세요.' }), list), voiceCard));
    view.appendChild(scr.el);
    ui.pagedList({ list, pager: scr.foot, items: sets, max: 4,
      empty: () => ui.emptyState('받아쓰기 문장이 없습니다.'),
      render: (s) => h('div', { class: 'card row-card' },
        h('div', { class: 'row-info' }, h('p', { class: 'strong', text: s.title }), h('p', { class: 'muted', text: s.sentences.length + '문장 · 예: ' + s.sentences.slice(0, 2).map((x) => x.text).join(' / ') + ' …' })),
        h('div', { class: 'btn-row' }, ui.btn('시작하기', { variant: 'primary', icon: '▶', cls: 'icon-after', onClick: () => { HG.screens.dictate.enterFullscreen(); HG.router.go('/dictate/' + s.id); } }))) }).draw();
    function drawVoice() {
      clear(voiceCard);
      voiceCard.appendChild(h('h2', { text: '🔊 읽어 주기 음성' }));
      const v = HG.tts.supported() && HG.tts.voice();
      if (v) voiceCard.appendChild(h('p', { text: '사용할 음성: ' + HG.tts.voiceLabel() }));
      else voiceCard.appendChild(h('p', { class: 'notice', text: HG.tts.supported() ? '한국어 음성을 찾지 못했습니다. 컴퓨터 설정에서 한국어 음성을 설치하거나, 강사님이 직접 읽어 주세요.' : '이 브라우저는 읽어 주기를 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.' }));
      voiceCard.appendChild(h('div', { class: 'btn-row' }, ui.btn('소리 시험', { icon: '♪', disabled: !HG.tts.supported(), onClick: () => HG.tts.speak('안녕하세요. 받아쓰기를 시작하겠습니다.') })));
    }
    drawVoice();
    offVoice = HG.tts.onVoice(drawVoice);
  }
  HG.screens.home = { mount, unmount() { if (offVoice) offVoice(); offVoice = null; } };
})();
