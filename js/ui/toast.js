/* 하단 알림 + 되돌리기 */
(function () {
  'use strict';
  const { h } = HG.dom;
  function show(msg, opts) {
    opts = opts || {};
    const host = document.getElementById('toast-host');
    HG.dom.clear(host);
    const t = h('div', { class: 'toast' + (opts.kind ? ' toast-' + opts.kind : '') }, h('span', { text: msg }));
    let timer;
    const close = () => { clearTimeout(timer); t.remove(); };
    if (opts.undo) {
      t.appendChild(h('button', { class: 'btn btn-accent btn-sm', type: 'button', text: '되돌리기',
        on: { click: () => { close(); opts.undo(); } } }));
    }
    host.appendChild(t);
    timer = setTimeout(close, opts.duration || (opts.undo ? 10000 : 5000));
    return close;
  }
  HG.toast = { show };
})();
