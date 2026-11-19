/* S-12 학습지 출력 — A4 인쇄 CSS + window.print() (FEATURES.md F-11) */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui, F = HG.format, L = HG.labels;
  const PAGE_H = 267; // 297 - 위아래 여백 15mm×2
  let st = null;

  /** 학습지 내용 → A4 쪽 배열 (높이 mm 기준 묶음) */
  function buildPages(o) {
    const k = o.size === 'xlarge' ? 1.2 : 1;
    const words = [], sentences = [];
    o.sets.forEach((s) => {
      s.words.forEach((w) => { if (!words.some((x) => x.text === w.text)) words.push(w); });
      s.sentences.forEach((x) => sentences.push(x));
    });
    const W = words.slice(0, 8), S = sentences.slice(0, 4);
    const M = words.filter(HG.validate.hasImage).slice(0, 4);
    const blocks = [];
    const sec = (n, title, rows) => { if (!rows.length) return; blocks.push({ h: 14, keep: true, el: h('h2', { class: 'ws-sec', text: n + '. ' + title }) }); rows.forEach((r) => blocks.push(r)); };
    const notes = [];
    let no = 1;
    if (o.sections.trace) {
      const cs = 20 * k, max = Math.floor(180 / (cs + 1));
      sec(no++, '따라 써 보세요', W.map((w) => {
        const syl = HG.hangul.syllables(w.text);
        const blanks = syl.length > 4 ? syl.length : Math.min(o.repeat * syl.length, max - syl.length);
        const rowsN = syl.length > 4 ? 2 : 1;
        const cell = (t) => h('span', { class: 'ws-cell' + (t ? ' is-guide' : '') }, t || '');
        const els = [h('div', { class: 'ws-cells' }, syl.map(cell), syl.length <= 4 ? Array.from({ length: blanks }, () => cell('')) : null)];
        if (rowsN === 2) els.push(h('div', { class: 'ws-cells' }, Array.from({ length: blanks }, () => cell(''))));
        return { h: rowsN * (cs + 5), el: h('div', { class: 'ws-row ws-trace', style: { '--cs': cs + 'mm' } }, els) };
      }));
    }
    if (o.sections.chosung) {
      const rows = [];
      for (let i = 0; i < W.length; i += 2) {
        rows.push({ h: 20 * k, el: h('div', { class: 'ws-row ws-cho' }, W.slice(i, i + 2).map((w) => h('div', { class: 'ws-cho-item' },
          h('span', { class: 'ws-cho-q', text: HG.hangul.getChosung(w.text) }), h('span', { class: 'ws-arrow', text: '→' }),
          h('span', { class: 'ws-line', style: { '--n': String(HG.hangul.syllableCount(w.text)) } })))) });
      }
      sec(no++, '초성을 보고 낱말을 써 보세요', rows);
    }
    if (o.sections.blank) {
      sec(no++, '빈칸에 알맞은 낱말을 써 보세요', S.map((x) => {
        const [a, , b] = HG.activities.blank.split(x.text, x.answer) || [x.text, '', ''];
        return { h: 24 * k, el: h('div', { class: 'ws-row ws-blank' }, h('p', { class: 'ws-sent' }, a, h('span', { class: 'ws-gap', style: { '--n': String(HG.hangul.syllableCount(x.answer)) } }), b),
          h('p', { class: 'ws-opts', text: '( ' + HG.act.shuffle([x.answer].concat(x.distractors)).join(' / ') + ' )' })) };
      }));
    }
    if (o.sections.match) {
      if (M.length >= 3) {
        const right = HG.act.shuffle(M);
        sec(no++, '그림과 낱말을 선으로 이어 보세요', M.map((w, i) => ({ h: 24 * k, el: h('div', { class: 'ws-row ws-match' },
          HG.images.render(w.image, { cls: 'ws-pic', fallbackText: w.text }), h('span', { class: 'ws-dot' }), h('span', { class: 'ws-space' }), h('span', { class: 'ws-dot' }),
          h('span', { class: 'ws-mword', text: right[i].text })) })));
      } else notes.push('그림이 있는 낱말이 3개 미만이라 선잇기는 빠졌습니다.');
    }
    // 묶기
    const pages = [];
    const header = (first) => h('header', { class: 'ws-head' + (first ? '' : ' is-small') },
      h('p', { class: 'ws-org', text: o.institution + ' · ' + o.program }),
      first ? h('h1', { class: 'ws-title', text: o.title }) : null,
      h('p', { class: 'ws-meta', text: F.dateLabel(o.date) + (o.topic ? ' · ' + o.topic : '') }));
    let page = null, left = 0;
    const newPage = () => { page = h('div', { class: 'ws-page' + (k > 1 ? ' is-xl' : ''), style: { '--k': String(k) } }); const first = !pages.length; page.appendChild(header(first)); left = PAGE_H - (first ? 30 : 14); pages.push(page); };
    newPage();
    blocks.forEach((b, i) => {
      const need = b.h + (b.keep && blocks[i + 1] ? blocks[i + 1].h : 0);
      if (need > left) newPage();
      page.appendChild(b.el);
      left -= b.h;
    });
    if (o.answerKey) {
      const ak = h('div', { class: 'ws-page ws-key' }, h('header', { class: 'ws-head' }, h('p', { class: 'ws-org', text: '강사용 정답지' }), h('h1', { class: 'ws-title', text: o.title }), h('p', { class: 'ws-meta', text: F.dateLabel(o.date) })));
      if (o.sections.chosung) ak.append(h('h2', { class: 'ws-sec', text: '초성' }), h('p', { text: W.map((w) => HG.hangul.getChosung(w.text) + ' → ' + w.text).join('   ') }));
      if (o.sections.blank) ak.append(h('h2', { class: 'ws-sec', text: '빈칸 문장' }), h('ol', null, S.map((x) => h('li', { text: x.text }))));
      if (o.sections.match && M.length >= 3) ak.append(h('h2', { class: 'ws-sec', text: '선잇기' }), h('p', { text: M.map((w) => ((w.image && w.image.kind === 'emoji') ? w.image.ref + ' ' : '') + w.text).join('   ') }));
      pages.push(ak);
    }
    return { pages, notes, wordCount: W.length };
  }

  async function mount(view, params) {
    const s = HG.state.settings;
    const [setsById, topics] = await Promise.all([HG.repo.setsMap(), HG.repo.topicsMap()]);
    let sets = [], date = F.todayStr(), title = '우리들의 즐거운 한글 교실 — 오늘의 복습';
    const src = params.source || 'choose';
    if (src.startsWith('lesson-')) {
      const l = await HG.db.get('lessons', src.slice(7));
      if (l) { sets = Array.from(new Set(l.activityPlan.map((x) => x.problemSetId))).map((id) => setsById[id]).filter(Boolean); date = l.date; }
    } else if (src.startsWith('set-') && setsById[src.slice(4)]) sets = [setsById[src.slice(4)]];
    st = { view, setsById, topics, o: { sets: sets.slice(0, 3), sections: { trace: true, chosung: true, blank: true, match: true }, size: 'large', repeat: 2, answerKey: false, title, date,
      institution: s.institutionName, program: s.programName }, page: 0 };
    render();
  }
  function topicName() { const t = st.o.sets[0] && st.topics[st.o.sets[0].topicId]; return t ? t.name : ''; }
  function render() {
    clear(st.view);
    const o = st.o;
    o.topic = topicName();
    const scr = ui.screen('학습지 출력', [ui.btn('홈으로', { icon: '🏠', onClick: () => HG.router.go('/home') })]);
    const panel = h('div', { class: 'card print-panel' });
    const vp = h('div', { class: 'ws-viewport' });
    const pageNav = h('div', { class: 'ws-nav' });
    scr.body.appendChild(h('div', { class: 'split print-split' }, panel, h('div', { class: 'print-preview' }, vp, pageNav)));
    st.view.appendChild(scr.el);
    const titleIn = ui.input({ value: o.title, max: 40, ariaLabel: '학습지 제목', onInput: (e) => { o.title = e.target.value; } });
    titleIn.addEventListener('change', () => { o.title = HG.validate.clean(o.title) || '오늘의 복습'; draw(); });
    const secs = h('div', { class: 'toggle-grid' });
    [['trace', '따라쓰기'], ['chosung', '초성'], ['blank', '빈칸 문장'], ['match', '선잇기']].forEach(([k, l]) => secs.appendChild(ui.toggle(l, o.sections[k], (v) => { o.sections[k] = v; draw(); })));
    const printBtn = ui.btn('인쇄하기 / PDF로 저장', { variant: 'primary', icon: '🖨', onClick: doPrint });
    panel.append(
      h('div', { class: 'print-sets' }, h('p', { class: 'strong', text: o.sets.length ? o.sets.map((x) => x.title).join(', ') : '세트를 골라 주세요' }), ui.btn('세트 고르기', { onClick: chooseSets })),
      ui.field('제목', titleIn),
      secs,
      h('div', { class: 'btn-row' },
        ui.segmented([{ value: 'large', label: '크게' }, { value: 'xlarge', label: '아주 크게' }], o.size, (v) => { o.size = v; draw(); }, '글자 크기'),
        ui.stepper({ label: '따라쓰기 빈칸', value: o.repeat, min: 1, max: 3, step: 1, format: (v) => '빈칸 ' + v + '번', onChange: (v) => { o.repeat = v; draw(); } })),
      h('div', { class: 'btn-row' }, ui.toggle('강사용 정답지', o.answerKey, (v) => { o.answerKey = v; draw(); }), printBtn),
      h('p', { class: 'muted small', text: "인쇄 창에서 '대상'을 'PDF로 저장'으로 바꾸면 PDF 파일로 저장됩니다." }));
    function draw() {
      clear(vp); clear(pageNav);
      const any = Object.values(o.sections).some(Boolean);
      if (!o.sets.length) { vp.appendChild(ui.emptyState('학습지에 넣을 문제 세트를 골라 주세요.', [ui.btn('세트 고르기', { variant: 'primary', onClick: chooseSets })])); printBtn.disabled = true; return; }
      if (!any) { vp.appendChild(ui.emptyState('넣을 항목을 한 가지 이상 골라 주세요.')); printBtn.disabled = true; return; }
      const r = buildPages(o);
      st.pages = r.pages;
      printBtn.disabled = !r.wordCount;
      if (st.page >= r.pages.length) st.page = 0;
      const pg = r.pages[st.page];
      const holder = h('div', { class: 'ws-scale' }, pg);
      vp.appendChild(holder);
      requestAnimationFrame(() => {
        const pw = pg.offsetWidth, ph = pg.offsetHeight;
        const sc = Math.min(vp.clientWidth / pw, vp.clientHeight / ph);
        holder.style.setProperty('--sc', String(sc));
        holder.style.setProperty('width', pw * sc + 'px');
        holder.style.setProperty('height', ph * sc + 'px');
      });
      if (r.notes.length) pageNav.appendChild(h('p', { class: 'notice small', text: r.notes.join(' ') }));
      if (r.pages.length > 1) pageNav.appendChild(ui.pager(st.page + 1, r.pages.length, (p) => { st.page = p - 1; draw(); }));
      else pageNav.appendChild(h('p', { class: 'muted', text: 'A4 1쪽' }));
    }
    st.redraw = draw;
    draw();
  }
  async function chooseSets() {
    const sets = Object.values(st.setsById).filter((s) => !s.isHidden).sort((a, b) => a.title.localeCompare(b.title));
    const chosen = new Set(st.o.sets.map((s) => s.id));
    const list = h('div', { class: 'pick-list' });
    const pager = h('div');
    const msg = h('p', { class: 'muted', text: '최대 3개까지 고를 수 있습니다.' });
    const ok = await HG.dialog.open({ title: '학습지에 넣을 세트', wide: true, body: h('div', { class: 'pick-body' }, msg, list, pager),
      actions: [{ label: '취소', value: false, focus: true }, { label: '고르기', value: true, variant: 'primary' }],
      onOpen: () => ui.pagedList({ list, pager, items: sets, max: 6, render: (s) => {
        const b = ui.toggle(s.title, chosen.has(s.id), (v) => {
          if (v && chosen.size >= 3) { b.click(); msg.textContent = '3개까지만 고를 수 있습니다.'; return; }
          if (v) chosen.add(s.id); else chosen.delete(s.id);
        });
        return b;
      } }).draw() });
    if (!ok) return;
    st.o.sets = Array.from(chosen).map((id) => st.setsById[id]).filter(Boolean);
    st.page = 0;
    render();
  }
  function doPrint() {
    const root = document.getElementById('print-root');
    clear(root);
    st.pages.forEach((p) => root.appendChild(p.cloneNode(true)));
    document.body.classList.add('printing-ws');
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.body.classList.remove('printing-ws'); }, 500);
    }, 50);
  }
  /** 임의 요소 인쇄 (통계 등) */
  function printNode(node, landscape) {
    const root = document.getElementById('print-root');
    clear(root);
    root.appendChild(h('div', { class: 'print-doc' + (landscape ? ' is-landscape' : '') }, node));
    document.body.classList.add('printing-doc');
    setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing-doc'), 500); }, 50);
  }
  HG.screens.print = { mount, buildPages, printNode, unmount() { const r = document.getElementById('print-root'); if (r) clear(r); st = null; } };
})();
