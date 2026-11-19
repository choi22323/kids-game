/* 관리자 PIN (F-17). 오조작 방지용이며 보안 장치가 아니다 (SECURITY.md §3) */
(function () {
  'use strict';
  const { h } = HG.dom;
  let fails = 0, lockedUntil = 0;

  const isSet = () => !!(HG.state.settings && HG.state.settings.adminPinHash);
  const available = () => HG.hash.hasSubtle();

  function keypad(title, msg, withForgot) {
    return new Promise((resolve) => {
      let val = '';
      const out = h('output', { class: 'pin-out', 'aria-live': 'polite' });
      const note = h('p', { class: 'pin-note' });
      const show = () => { out.textContent = val ? '●'.repeat(val.length) : '　'; };
      const pad = h('div', { class: 'pin-pad' });
      let closeFn = null;
      const press = (k) => {
        if (k === '지우기') val = val.slice(0, -1);
        else if (k === '확인') { if (val.length >= 4) closeFn(val); else note.textContent = '4~6자리 숫자를 눌러 주세요.'; return; }
        else if (val.length < 6) val += k;
        show();
      };
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지우기', '0', '확인'].forEach((k) => {
        pad.appendChild(HG.ui.btn(k, { variant: k === '확인' ? 'primary' : 'secondary', onClick: () => press(k) }));
      });
      const onKey = (e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === 'Backspace') press('지우기');
        else if (e.key === 'Enter') press('확인');
      };
      HG.dialog.open({
        title, body: h('div', { class: 'pin-body' }, h('p', { text: msg }), out, note, pad),
        actions: (withForgot ? [{ label: 'PIN을 잊으셨나요?', value: '__forgot__' }] : []).concat([{ label: '취소', value: null, focus: true }]),
        onOpen: (dlg, close) => { closeFn = close; dlg.addEventListener('keydown', onKey); show(); }
      }).then(resolve);
    });
  }

  async function ask(msg) {
    if (!isSet()) return true;
    if (Date.now() < lockedUntil) {
      await HG.dialog.alert('잠시 기다려 주세요', Math.ceil((lockedUntil - Date.now()) / 1000) + '초 뒤에 다시 시도해 주세요.');
      return false;
    }
    const s = HG.state.settings;
    const v = await keypad('PIN 입력', msg || 'PIN을 입력해 주세요.', true);
    if (v === '__forgot__') return forgot();
    if (!v) return false;
    let hash;
    try { hash = await HG.hash.pbkdf2Hex(v, s.adminPinSalt); } catch (e) { return true; }
    if (hash === s.adminPinHash) { fails = 0; return true; }
    fails++;
    if (fails >= 5) { lockedUntil = Date.now() + 60000; fails = 0; await HG.dialog.alert('PIN이 맞지 않습니다', '5번 틀려서 60초 동안 입력할 수 없습니다.'); return false; }
    const again = await HG.dialog.open({ title: 'PIN이 맞지 않습니다', body: '다시 입력해 주세요. (' + fails + '/5)',
      actions: [{ label: '취소', value: false }, { label: 'PIN을 잊으셨나요?', value: 'forgot' }, { label: '다시 입력', value: true, variant: 'primary', focus: true }] });
    if (again === 'forgot') return forgot();
    return again ? ask(msg) : false;
  }
  async function forgot() {
    const ok = await HG.dialog.typeToConfirm('PIN 초기화', 'PIN만 해제됩니다. 수업 자료는 지워지지 않습니다.\n이 PIN은 실수로 화면을 바꾸지 않게 하는 장치입니다.', 'PIN 초기화', 'PIN 해제');
    if (!ok) return false;
    await clear();
    HG.toast.show('PIN을 해제했습니다.');
    return true;
  }
  async function setNew() {
    if (!available()) { await HG.dialog.alert('PIN을 쓸 수 없습니다', '이 브라우저 환경에서는 PIN 기능을 사용할 수 없습니다.'); return false; }
    const a = await keypad('새 PIN 설정', '4~6자리 숫자를 눌러 주세요.');
    if (!a) return false;
    const b = await keypad('새 PIN 확인', '같은 숫자를 한 번 더 눌러 주세요.');
    if (!b) return false;
    if (a !== b) { await HG.dialog.alert('PIN이 서로 다릅니다', '처음부터 다시 설정해 주세요.'); return false; }
    const salt = HG.hash.randomHex(16);
    const hash = await HG.hash.pbkdf2Hex(a, salt);
    await HG.repo.setSetting('adminPinSalt', salt);
    await HG.repo.setSetting('adminPinHash', hash);
    HG.state.adminUnlocked = true;
    return true;
  }
  async function clear() {
    await HG.repo.setSetting('adminPinHash', null);
    await HG.repo.setSetting('adminPinSalt', null);
  }
  HG.pin = { isSet, available, ask, setNew, clear, forgot };
  HG.screens.pin = HG.pin;
})();
