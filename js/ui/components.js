/* 공통 컴포넌트: 버튼, 페이지 나눔, 빈 상태, 입력 필드, 토글, -/+ 조절, 길게 누르기 */
(function () {
  'use strict';
  const { h, clear } = HG.dom;

  function btn(label, o) {
    o = o || {};
    let last = 0;
    const b = h('button', {
      type: 'button',
      class: 'btn btn-' + (o.variant || 'secondary') + (o.cls ? ' ' + o.cls : ''),
      disabled: !!o.disabled,
      'aria-label': o.ariaLabel || null,
      'aria-pressed': o.pressed == null ? null : String(!!o.pressed),
      title: o.title || null
    }, o.icon ? h('span', { class: 'btn-icon', 'aria-hidden': 'true', text: o.icon }) : null, label ? h('span', { text: label }) : null);
    if (o.onClick) {
      b.addEventListener('click', (e) => {
        const now = Date.now();
        if (now - last < 300) return; // 연타 방지
        last = now;
        o.onClick(e);
      });
    }
    return b;
  }

  function header(title, actions, sub) {
    return h('div', { class: 'screen-head' },
      h('div', { class: 'screen-title' }, h('h1', { text: title }), sub ? h('p', { class: 'sub', text: sub }) : null),
      actions && actions.length ? h('div', { class: 'btn-row' }, actions) : null);
  }

  function screen(title, actions, sub) {
    const head = header(title, actions, sub);
    const body = h('div', { class: 'screen-body' });
    const foot = h('div', { class: 'screen-foot' });
    const el = h('section', { class: 'screen' }, head, body, foot);
    return { el, head, body, foot };
  }

  function emptyState(msg, actions) {
    return h('div', { class: 'empty' }, h('p', { text: msg }), actions && actions.length ? h('div', { class: 'btn-row' }, actions) : null);
  }

  /**
   * 넘치지 않는 만큼만 렌더링하는 페이지 목록. 스크롤 대신 페이지 나눔 (UI_UX.md §4.3)
   * 목록 자체와 각 항목(카드) 안의 잘림을 모두 검사하고, 크기가 바뀌면 다시 맞춘다.
   * @param {{list:HTMLElement, pager:HTMLElement, items:any[], render:(item,i)=>Node, max:number, empty?:()=>Node}} o
   */
  function pagedList(o) {
    let first = 0, lastH = -1, lastW = -1, drawing = false;
    const clipped = (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    function fits() {
      if (clipped(o.list)) return false;
      for (const c of o.list.children) {
        if (c.clientHeight && getComputedStyle(c).overflow !== 'visible' && clipped(c)) return false;
      }
      return true;
    }
    function draw() {
      if (drawing) return;
      drawing = true;
      clear(o.list); clear(o.pager);
      if (!o.items.length) { if (o.empty) o.list.appendChild(o.empty()); drawing = false; remember(); return; }
      let size = Math.min(o.max, o.items.length);
      for (;;) {
        clear(o.list); clear(o.pager);
        first = Math.floor(first / size) * size;
        if (first >= o.items.length) first = Math.max(0, Math.floor((o.items.length - 1) / size) * size);
        o.items.slice(first, first + size).forEach((it, i) => o.list.appendChild(o.render(it, first + i)));
        const pages = Math.ceil(o.items.length / size);
        if (pages > 1) {
          const page = Math.floor(first / size) + 1;
          const sz = size;
          o.pager.appendChild(pager(page, pages, (p) => { first = (p - 1) * sz; draw(); }));
        }
        if (size <= 1 || !o.list.isConnected || fits()) break;
        size--;
      }
      drawing = false;
      remember();
    }
    function remember() { lastH = o.list.clientHeight; lastW = o.list.clientWidth; }
    if (window.ResizeObserver) {
      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (!o.list.isConnected) { ro.disconnect(); return; }
        if (drawing || (o.list.clientHeight === lastH && o.list.clientWidth === lastW)) return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      });
      ro.observe(o.list);
    }
    const api = {
      draw,
      setItems(items) { o.items = items; first = 0; draw(); },
      refresh() { draw(); },
      showIndex(i) { first = i; draw(); }
    };
    return api;
  }
  /** 미리 만든 노드 목록(폼 줄, 설정 줄, 카드)을 넘치지 않게 쪽으로 나눠 보여 준다 */
  function pagedNodes(container, nodes, max, cls) {
    const list = h('div', { class: 'paged ' + (cls || 'paged-col') });
    const pagerHost = h('div', { class: 'paged-pager' });
    container.append(list, pagerHost);
    const pl = pagedList({ list, pager: pagerHost, items: nodes.filter(Boolean), max: max || 99, render: (n) => n });
    pl.draw();
    return pl;
  }

  function pager(page, pages, go) {
    return h('div', { class: 'pager', role: 'navigation', 'aria-label': '쪽 이동' },
      btn('이전', { icon: '◀', disabled: page <= 1, onClick: () => go(page - 1), ariaLabel: '이전 쪽' }),
      h('span', { class: 'pager-num', 'aria-live': 'polite', text: page + ' / ' + pages }),
      btn('다음', { icon: '▶', disabled: page >= pages, onClick: () => go(page + 1), ariaLabel: '다음 쪽', cls: 'icon-after' }));
  }

  let fieldSeq = 0;
  /** 라벨 왼쪽 + 입력 오른쪽 한 줄 필드 */
  function field(label, input, o) {
    o = o || {};
    const id = input.id || 'f' + (++fieldSeq);
    input.id = id;
    const err = h('div', { class: 'field-error', id: id + '-err', 'aria-live': 'polite' });
    input.setAttribute('aria-describedby', id + '-err');
    if (o.field) input.dataset.field = o.field;
    const el = h('div', { class: 'field' + (o.cls ? ' ' + o.cls : '') },
      h('label', { for: id, text: label }), h('div', { class: 'field-input' }, input, o.after || null, err));
    return el;
  }
  function input(o) {
    o = o || {};
    return h('input', { class: 'input', type: o.type || 'text', value: o.value == null ? '' : String(o.value), maxlength: o.max || null,
      placeholder: o.placeholder || null, 'aria-label': o.ariaLabel || null, autocomplete: 'off', inputmode: o.inputmode || null,
      on: o.onInput ? { input: o.onInput } : null });
  }
  function select(options, value, onChange, ariaLabel) {
    const s = h('select', { class: 'input', 'aria-label': ariaLabel || null, on: { change: (e) => onChange && onChange(e.target.value) } },
      options.map((op) => h('option', { value: op.value, text: op.label, selected: op.value === value, disabled: !!op.disabled })));
    s.value = value == null ? '' : value;
    return s;
  }
  /** 여러 버튼 중 하나 선택 */
  function segmented(options, value, onChange, ariaLabel) {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': ariaLabel || null });
    function draw() {
      clear(wrap);
      options.forEach((op) => {
        const sel = op.value === value;
        const b = h('button', { type: 'button', class: 'btn btn-seg' + (sel ? ' is-selected' : ''), role: 'radio', 'aria-checked': String(sel),
          disabled: !!op.disabled, text: op.label, on: { click: () => { value = op.value; draw(); onChange && onChange(value); } } });
        wrap.appendChild(b);
      });
    }
    draw();
    wrap.getValue = () => value;
    wrap.setValue = (v) => { value = v; draw(); };
    return wrap;
  }
  function toggle(label, on, onChange) {
    const b = btn(label, { variant: 'seg', cls: on ? 'is-selected' : '', pressed: on });
    b.addEventListener('click', () => {
      on = !on;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
      onChange && onChange(on);
    });
    return b;
  }
  /** -/+ 버튼 조절기 (슬라이더 대신: 큰 터치 화면의 미세 드래그 어려움) */
  function stepper(o) {
    let v = o.value;
    const out = h('output', { class: 'stepper-val', 'aria-live': 'polite' });
    const show = () => { out.textContent = o.format ? o.format(v) : String(v); minus.disabled = v <= o.min; plus.disabled = v >= o.max; };
    const set = (nv) => { nv = Math.round(Math.min(o.max, Math.max(o.min, nv)) * 1000) / 1000; if (nv === v) return; v = nv; show(); o.onChange && o.onChange(v); };
    const minus = btn('', { icon: '−', ariaLabel: (o.label || '') + ' 줄이기', onClick: () => set(v - o.step) });
    const plus = btn('', { icon: '+', ariaLabel: (o.label || '') + ' 늘리기', onClick: () => set(v + o.step) });
    const el = h('div', { class: 'stepper', role: 'group', 'aria-label': o.label || null }, minus, out, plus);
    show();
    el.getValue = () => v;
    return el;
  }
  /** 길게 누르기 버튼(기본 2초). 키보드는 Enter 길게 또는 확인 대화상자 */
  function longPress(label, ms, onDone, o) {
    o = o || {};
    const b = btn(label, { variant: o.variant || 'secondary', icon: o.icon, cls: 'longpress', ariaLabel: label + ' (2초 동안 길게 누르기)' });
    let start = 0, raf = 0;
    const reset = () => { cancelAnimationFrame(raf); start = 0; b.style.setProperty('--p', '0'); };
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / ms);
      b.style.setProperty('--p', String(p));
      if (p >= 1) { reset(); onDone(); return; }
      raf = requestAnimationFrame(tick);
    };
    const begin = () => { if (start) return; start = performance.now(); raf = requestAnimationFrame(tick); };
    b.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') begin(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, reset));
    b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); begin(); } });
    b.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') reset(); });
    b.addEventListener('click', (e) => { if (e.detail === 0) e.preventDefault(); });
    return b;
  }
  /** 필드 오류 표시: errors=[{field,msg}] */
  function showErrors(root, errors) {
    root.querySelectorAll('.is-invalid').forEach((el) => { el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); });
    root.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    let firstEl = null;
    (errors || []).forEach((er) => {
      const el = root.querySelector('[data-field="' + er.field + '"]');
      if (!el) return;
      el.classList.add('is-invalid');
      el.setAttribute('aria-invalid', 'true');
      const box = el.id && root.querySelector('#' + CSS.escape(el.id) + '-err');
      if (box && !box.textContent) box.textContent = er.msg;
      if (!firstEl) firstEl = el;
    });
    if (firstEl) firstEl.focus();
    return firstEl;
  }
  function errorSummary(errors) {
    return h('div', { class: 'error-summary', role: 'alert' },
      h('p', { class: 'strong', text: '고칠 내용이 ' + errors.length + '건 있습니다.' }),
      h('ul', null, errors.slice(0, 4).map((e) => h('li', { text: e.msg }))),
      errors.length > 4 ? h('p', { text: '외 ' + (errors.length - 4) + '건' }) : null);
  }
  function badge(text, kind) { return h('span', { class: 'badge' + (kind ? ' badge-' + kind : ''), text }); }

  HG.ui = { btn, header, screen, emptyState, pagedList, pagedNodes, pager, field, input, select, segmented, toggle, stepper, longPress, showErrors, errorSummary, badge };
})();
