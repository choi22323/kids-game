/* S-20 화면·소리 설정 + 관리자 PIN (FEATURES.md F-16, F-17) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui;
  let tab = 'screen';

  async function mount(view) {
    const s = HG.state.settings;
    const set = (k, v) => HG.repo.setSetting(k, v).then(() => HG.applySettings()).catch(() => HG.toast.show('저장하지 못했습니다.'));
    const scr = ui.screen('설정', [ui.btn('홈으로', { icon: '🏠', onClick: () => HG.router.go('/home') }),
      ui.btn('기본값으로', { onClick: async () => { if (await HG.dialog.confirm('기본값으로 되돌리기', '화면·소리 설정을 처음 상태로 되돌릴까요? (PIN은 유지)', { ok: '되돌리기' })) { await HG.repo.resetSettings(); HG.applySettings(); HG.router.rerender(); } } })]);
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const panel = h('div', { class: 'tab-panel', role: 'tabpanel' });
    [['screen', '화면'], ['sound', '읽어 주기·소리'], ['pin', '관리자 잠금']].forEach(([k, l]) => tabs.appendChild(
      h('button', { type: 'button', role: 'tab', class: 'tab' + (tab === k ? ' is-cur' : ''), 'aria-selected': String(tab === k), text: l, on: { click: () => { tab = k; HG.router.rerender(); } } })));
    scr.body.appendChild(h('div', { class: 'editor' }, tabs, panel));
    view.appendChild(scr.el);
    const row = (label, ctrl, note) => h('div', { class: 'set-row' }, h('span', { class: 'label', text: label }), h('div', { class: 'set-ctrl' }, ctrl, note ? h('p', { class: 'muted small', text: note }) : null));

    if (tab === 'screen') {
      const preview = h('canvas', { class: 'stroke-preview', width: 400, height: 80, 'aria-hidden': 'true' });
      const drawPreview = (w) => {
        const c = preview.getContext('2d'); c.clearRect(0, 0, 400, 80); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#172332'; c.lineWidth = w;
        c.beginPath(); c.moveTo(30, 55); c.quadraticCurveTo(120, 5, 200, 40); c.quadraticCurveTo(280, 75, 370, 25); c.stroke();
      };
      ui.pagedNodes(panel, [
        row('글자 크기', ui.segmented([{ value: 1, label: '보통' }, { value: 1.15, label: '크게' }, { value: 1.3, label: '아주 크게' }], s.fontScale, (v) => set('fontScale', v), '글자 크기'),
          '어떤 크기에서도 화면이 넘치지 않도록 한 화면의 항목 수가 조정됩니다.'),
        row('칸 안 흐린 글씨', ui.segmented([{ value: 'off', label: '없음' }, { value: 'always', label: '쓸 때부터 보기' }], s.dictGuide, (v) => set('dictGuide', v), '칸 안 흐린 글씨'),
          '기본은 없음입니다. "쓸 때부터 보기"는 따라쓰기처럼 흐린 글씨가 칸에 보입니다. 정답은 [다 썼어요]를 누르면 아래 칸에 나옵니다.'),
        row('필기 굵기', h('div', { class: 'btn-row' }, ui.stepper({ label: '필기 굵기', value: s.traceStrokeWidth, min: 12, max: 40, step: 4, format: (v) => v + 'px', onChange: (v) => { set('traceStrokeWidth', v); drawPreview(v); } }), preview)),
        row('문제 순서', ui.toggle('문제 섞기', s.shuffleQuestions, (v) => set('shuffleQuestions', v)))], 5);
      drawPreview(s.traceStrokeWidth);
    } else if (tab === 'sound') {
      ui.pagedNodes(panel, [
        row('목소리', h('div', { class: 'btn-row' },
          ui.select([{ value: '', label: '자동 (가장 친근한 목소리)' }].concat(HG.tts.koreanVoices().map((v) => ({ value: v.name, label: v.name + (v.localService ? ' · 이 컴퓨터' : ' · 인터넷 필요') }))), s.ttsVoice, (v) => set('ttsVoice', v), '목소리'),
          ui.btn('들어 보기', { icon: '🔊', onClick: () => HG.tts.speak('안녕하세요. 오늘도 같이 받아쓰기 해 볼까요?') })),
          HG.tts.koreanVoices().length ? '이 컴퓨터에서 쓸 수 있는 한국어 목소리 ' + HG.tts.koreanVoices().length + '개 · 지금: ' + (HG.tts.voiceLabel() || '없음') : '한국어 목소리를 찾지 못했습니다. 컴퓨터에 한국어 목소리(음성)를 설치해 주세요.'),
        row('목소리 높낮이', ui.stepper({ label: '목소리 높낮이', value: s.ttsPitch, min: 0.8, max: 1.4, step: 0.05, format: (v) => (v < 0.95 ? '낮고 차분하게' : v <= 1.05 ? '보통' : v <= 1.2 ? '조금 밝게' : '밝게') + ' (' + Math.round(v * 100) + '%)', onChange: (v) => set('ttsPitch', v) })),
        row('읽기 속도', ui.stepper({ label: '읽기 속도', value: s.ttsRate, min: 0.5, max: 1.2, step: 0.05, format: (v) => (v <= 0.7 ? '아주 천천히' : v <= 0.85 ? '천천히' : v <= 1 ? '보통' : '조금 빠르게') + ' (' + Math.round(v * 100) + '%)', onChange: (v) => set('ttsRate', v) })),
        row('효과음', h('div', { class: 'btn-row' }, ui.toggle('효과음 켜기', s.soundEnabled, (v) => set('soundEnabled', v)),
          ui.btn('들어 보기', { icon: '♪', onClick: () => { if (!HG.audio.play('correct')) HG.toast.show('소리가 꺼져 있거나 이 브라우저에서 소리를 낼 수 없습니다.'); } }))),
        row('음량', ui.stepper({ label: '음량', value: Math.round(s.volume * 10), min: 0, max: 10, step: 1, format: (v) => v * 10 + '%', onChange: (v) => set('volume', v / 10) })),
        row('애니메이션', ui.segmented([{ value: 'auto', label: '컴퓨터 설정 따름' }, { value: 'on', label: '줄이기' }, { value: 'off', label: '모두 보이기' }], s.reduceMotion, (v) => set('reduceMotion', v), '애니메이션'))], 5);
    } else {
      const on = HG.pin.isSet();
      ui.pagedNodes(panel, [
        row('관리자 PIN', h('div', { class: 'btn-row' },
          ui.btn(on ? 'PIN 바꾸기' : 'PIN 설정', { variant: 'primary', disabled: !HG.pin.available(), onClick: async () => { if (on && !(await HG.pin.ask('지금 PIN을 입력해 주세요.'))) return; if (await HG.pin.setNew()) { HG.toast.show('PIN을 설정했습니다.'); HG.router.rerender(); } } }),
          on ? ui.btn('PIN 해제', { onClick: async () => { if (await HG.pin.ask('지금 PIN을 입력해 주세요.')) { await HG.pin.clear(); HG.toast.show('PIN을 해제했습니다.'); HG.router.rerender(); } } }) : null),
        on ? '지금 PIN이 설정되어 있습니다.' : 'PIN이 설정되어 있지 않습니다.'),
        h('p', { class: 'notice', text: '⚠ 이 PIN은 어르신이 실수로 관리 화면에 들어가거나 수업 모드를 나가지 않게 하는 장치입니다. 보안 장치가 아니며, 브라우저를 다룰 줄 아는 사람은 해제할 수 있습니다.' }),
        HG.pin.available() ? null : h('p', { class: 'muted', text: '이 브라우저 환경에서는 PIN 기능을 사용할 수 없습니다.' })], 5);
    }
  }
  HG.screens.adminDisplay = { mount };
})();
