/* S-20 화면·소리 설정 + 관리자 PIN (FEATURES.md F-16, F-17) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui, V = HG.validate;
  let tab = 'screen';

  async function mount(view) {
    const s = HG.state.settings;
    const set = (k, v) => HG.repo.setSetting(k, v).then(() => HG.applySettings()).catch(() => HG.toast.show('저장하지 못했습니다.'));
    const scr = ui.screen('화면·소리', [ui.btn('관리자 설정', { icon: '◀', onClick: () => HG.router.go('/admin') }),
      ui.btn('기본값으로', { onClick: async () => { if (await HG.dialog.confirm('기본값으로 되돌리기', '화면·소리 설정을 처음 상태로 되돌릴까요? (PIN은 유지)', { ok: '되돌리기' })) { await HG.repo.resetSettings(); HG.applySettings(); HG.router.rerender(); } } })]);
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const panel = h('div', { class: 'tab-panel', role: 'tabpanel' });
    [['screen', '화면'], ['sound', '소리·움직임'], ['print', '학습지·기록'], ['pin', '관리자 잠금']].forEach(([k, l]) => tabs.appendChild(
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
      panel.append(
        row('글자 크기', ui.segmented([{ value: 1, label: '보통' }, { value: 1.15, label: '크게' }, { value: 1.3, label: '아주 크게' }], s.fontScale, (v) => set('fontScale', v), '글자 크기'),
          '어떤 크기에서도 화면이 넘치지 않도록 한 화면의 항목 수가 조정됩니다.'),
        row('필기 굵기', h('div', { class: 'btn-row' }, ui.stepper({ label: '필기 굵기', value: s.traceStrokeWidth, min: 12, max: 40, step: 4, format: (v) => v + 'px', onChange: (v) => { set('traceStrokeWidth', v); drawPreview(v); } }), preview)),
        row('문제 순서', ui.toggle('문제 섞기', s.shuffleQuestions, (v) => set('shuffleQuestions', v))));
      drawPreview(s.traceStrokeWidth);
    } else if (tab === 'sound') {
      panel.append(
        row('효과음', h('div', { class: 'btn-row' }, ui.toggle('소리 켜기', s.soundEnabled, (v) => set('soundEnabled', v)),
          ui.btn('들어 보기', { icon: '♪', onClick: () => { if (!HG.audio.play('correct')) HG.toast.show('소리가 꺼져 있거나 이 브라우저에서 소리를 낼 수 없습니다.'); } }))),
        row('음량', ui.stepper({ label: '음량', value: Math.round(s.volume * 10), min: 0, max: 10, step: 1, format: (v) => v * 10 + '%', onChange: (v) => set('volume', v / 10) })),
        row('애니메이션', ui.segmented([{ value: 'auto', label: '컴퓨터 설정 따름' }, { value: 'on', label: '줄이기' }, { value: 'off', label: '모두 보이기' }], s.reduceMotion, (v) => set('reduceMotion', v), '애니메이션')));
    } else if (tab === 'print') {
      const inst = ui.input({ value: s.institutionName, max: 30 });
      const prog = ui.input({ value: s.programName, max: 30 });
      const saveText = async (k, el) => { const v = V.clean(el.value); if (HG.repo.validSetting(k, v)) { await set(k, v); HG.toast.show('저장했습니다.'); } else HG.toast.show('1~30자로 입력해 주세요.'); };
      inst.addEventListener('change', () => saveText('institutionName', inst));
      prog.addEventListener('change', () => saveText('programName', prog));
      panel.append(
        row('학습지 기관명', inst), row('학습지 프로그램명', prog),
        row('백업 알림', ui.stepper({ label: '백업 알림 주기', value: s.backupReminderDays, min: 0, max: 30, step: 1, format: (v) => (v ? v + '일마다' : '끔'), onChange: (v) => set('backupReminderDays', v) })),
        row('기록 보존 안내', ui.stepper({ label: '기록 보존 안내 기간', value: s.recordRetentionMonths, min: 0, max: 60, step: 1, format: (v) => (v ? v + '개월' : '끔'), onChange: (v) => set('recordRetentionMonths', v) }),
          '기간이 지난 기록은 자동으로 지우지 않고 안내만 합니다. 보존 기간은 기관 규정 확인이 필요합니다.'));
    } else {
      const on = HG.pin.isSet();
      panel.append(
        row('관리자 PIN', h('div', { class: 'btn-row' },
          ui.btn(on ? 'PIN 바꾸기' : 'PIN 설정', { variant: 'primary', disabled: !HG.pin.available(), onClick: async () => { if (on && !(await HG.pin.ask('지금 PIN을 입력해 주세요.'))) return; if (await HG.pin.setNew()) { HG.toast.show('PIN을 설정했습니다.'); HG.router.rerender(); } } }),
          on ? ui.btn('PIN 해제', { onClick: async () => { if (await HG.pin.ask('지금 PIN을 입력해 주세요.')) { await HG.pin.clear(); HG.toast.show('PIN을 해제했습니다.'); HG.router.rerender(); } } }) : null),
        on ? '지금 PIN이 설정되어 있습니다.' : 'PIN이 설정되어 있지 않습니다.'),
        h('p', { class: 'notice', text: '⚠ 이 PIN은 어르신이 실수로 관리 화면에 들어가거나 수업 모드를 나가지 않게 하는 장치입니다. 보안 장치가 아니며, 브라우저를 다룰 줄 아는 사람은 해제할 수 있습니다. PIN은 백업 파일에 들어가지 않습니다.' }),
        HG.pin.available() ? null : h('p', { class: 'muted', text: '이 브라우저 환경에서는 PIN 기능을 사용할 수 없습니다.' }));
    }
  }
  HG.screens.adminDisplay = { mount };
})();
