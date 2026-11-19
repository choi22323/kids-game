/* 대화상자: 포커스 트랩, Esc=취소, 기본 포커스는 안전한 쪽 (UI_UX.md §6) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const stack = [];

  function focusables(root) {
    return Array.from(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.offsetParent !== null);
  }

  /**
   * @param {{title:string, body?:Node|string, actions:{label:string,value:any,variant?:string,focus?:boolean}[], noEsc?:boolean, wide?:boolean, onOpen?:Function}} o
   * @returns {Promise<any>} 누른 버튼의 value (Esc는 null)
   */
  function open(o) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const host = document.getElementById('dialog-host');
      const titleId = 'dlg-' + Math.random().toString(36).slice(2);
      let done = false;
      const close = (val) => {
        if (done) return;
        done = true;
        back.remove();
        document.removeEventListener('keydown', onKey, true);
        stack.pop();
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* 무시 */ }
        resolve(val);
      };
      const body = typeof o.body === 'string'
        ? h('div', { class: 'dialog-text' }, o.body.split('\n').map((line) => h('p', { text: line })))
        : o.body;
      const actions = h('div', { class: 'btn-row dialog-actions' });
      let focusBtn = null;
      (o.actions || [{ label: '확인', value: true }]).forEach((a) => {
        const b = h('button', { type: 'button', class: 'btn btn-' + (a.variant || 'secondary'), text: a.label,
          on: { click: () => close(typeof a.value === 'function' ? a.value() : a.value) } });
        if (a.focus) focusBtn = b;
        actions.appendChild(b);
      });
      const dlg = h('div', { class: 'dialog' + (o.wide ? ' dialog-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
        h('h2', { id: titleId, text: o.title }), body, actions);
      const back = h('div', { class: 'dialog-backdrop' }, dlg);
      const onKey = (e) => {
        if (stack[stack.length - 1] !== dlg) return;
        if (e.key === 'Escape' && !o.noEsc) { e.preventDefault(); e.stopPropagation(); close(null); return; }
        if (e.key === 'Tab') {
          const f = focusables(dlg);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        e.stopPropagation();
      };
      document.addEventListener('keydown', onKey, true);
      stack.push(dlg);
      host.appendChild(back);
      dlg.closeWith = close;
      if (o.onOpen) o.onOpen(dlg, close);
      (focusBtn || actions.firstChild || dlg).focus();
    });
  }
  function alert(title, msg) {
    return open({ title, body: msg, actions: [{ label: '확인', value: true, variant: 'primary', focus: true }] });
  }
  function confirm(title, msg, opts) {
    opts = opts || {};
    return open({
      title, body: msg,
      actions: [
        { label: opts.cancel || '취소', value: false, focus: true },
        { label: opts.ok || '확인', value: true, variant: opts.danger ? 'danger' : 'primary' }
      ]
    }).then((v) => v === true);
  }
  /** 정확한 문구를 입력해야 진행 */
  function typeToConfirm(title, msg, phrase, okLabel) {
    const input = h('input', { class: 'input', type: 'text', 'aria-label': '확인 문구 입력', autocomplete: 'off' });
    const body = h('div', { class: 'dialog-text' }, msg.split('\n').map((l) => h('p', { text: l })),
      h('p', { class: 'strong', text: "확인하려면 '" + phrase + "'를 정확히 입력해 주세요." }), input);
    return open({
      title, body,
      actions: [{ label: '취소', value: false, focus: true }, { label: okLabel || '진행', variant: 'danger', value: () => input.value.trim() === phrase }],
      onOpen: () => setTimeout(() => input.focus(), 0)
    }).then((v) => v === true);
  }
  HG.dialog = { open, alert, confirm, typeToConfirm };
})();
