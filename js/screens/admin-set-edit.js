/* S-16 문제 세트 편집 (FEATURES.md F-12) — 탭 + 페이지 나눔으로 스크롤 없이 */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui, L = HG.labels, V = HG.validate;
  let st = null;

  function blankSet(topicId) {
    return {
      id: HG.ids.uuid(), title: '', topicId, level: 'beginner', description: '', isBuiltIn: false, isHidden: false,
      words: [1, 2, 3, 4].map((n) => ({ id: 'w' + n, text: '', image: null, hint: '', order: n - 1 })), sentences: [],
      activityOptions: { trace: { enabled: true, gridStyle: 'cross', repeat: 1 }, chosung: { enabled: true, optionCount: 3, showImageHint: true }, match: { enabled: true, pairsPerRound: 3 }, blank: { enabled: true } },
      tags: [], sourceSetId: null
    };
  }
  async function mount(view, params) {
    const topics = await HG.repo.topics();
    let s = params.id === 'new' ? blankSet(topics[0] ? topics[0].id : '') : await HG.db.get('problemSets', params.id);
    if (!s) { view.appendChild(ui.emptyState('문제 세트를 찾을 수 없습니다.', [ui.btn('목록으로', { onClick: () => HG.router.go('/admin/sets') })])); return; }
    st = { view, s: JSON.parse(JSON.stringify(s)), isNew: params.id === 'new', topics, tab: 'info', dirty: false, errors: [], warnings: [], pages: {} };
    render();
  }
  const mark = () => { st.dirty = true; };
  const nextId = (arr, p) => { let n = arr.length + 1; while (arr.some((x) => x.id === p + n)) n++; return p + n; };

  function render() {
    clear(st.view);
    const s = st.s, ro = s.isBuiltIn;
    const scr = ui.screen(st.isNew ? '새 문제 세트' : ro ? '기본 자료 보기' : '문제 세트 편집', null,
      ro ? '🔒 기본 자료는 고칠 수 없습니다. [복제해서 편집]을 눌러 우리 반에 맞게 바꿔 주세요.' : null);
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const count = (tab) => st.errors.filter((e) => e.tab === tab).length;
    [['info', '기본 정보'], ['words', '낱말 (' + s.words.length + ')'], ['sentences', '문장 (' + s.sentences.length + ')'], ['options', '활동 옵션']].forEach(([k, label]) => {
      const n = count(k);
      tabs.appendChild(h('button', { type: 'button', role: 'tab', class: 'tab' + (st.tab === k ? ' is-cur' : ''), 'aria-selected': String(st.tab === k),
        on: { click: () => { st.tab = k; render(); } } }, label, n ? h('span', { class: 'tab-err', text: ' ⚠' + n }) : null));
    });
    const panel = h('div', { class: 'tab-panel', role: 'tabpanel' });
    scr.body.appendChild(h('div', { class: 'editor' }, tabs, panel));
    st.view.appendChild(scr.el);
    const errs = st.errors.filter((e) => e.tab === st.tab);
    const warns = st.warnings.filter((e) => e.tab === st.tab);
    if (errs.length) panel.appendChild(ui.errorSummary(errs));
    else if (warns.length) panel.appendChild(h('div', { class: 'warn-summary' }, h('p', { class: 'strong', text: '확인해 주세요 (' + warns.length + '건)' }), h('p', { text: warns[0].msg })));
    ({ info: infoTab, words: wordsTab, sentences: sentTab, options: optTab })[st.tab](panel, ro);
    const foot = h('div', { class: 'btn-row end' }, ui.btn('목록으로', { icon: '◀', onClick: () => HG.router.go('/admin/sets') }));
    if (ro) foot.appendChild(ui.btn('복제해서 편집', { variant: 'primary', onClick: async () => { const c = await HG.screens.adminSets.duplicate(st.s); st.dirty = false; HG.router.go('/admin/sets/' + c.id); } }));
    else foot.appendChild(ui.btn('저장', { variant: 'primary', icon: '✔', onClick: save }));
    scr.foot.appendChild(foot);
    if (errs.length) ui.showErrors(panel, errs);
    if (ro) panel.querySelectorAll('input, select, button:not(.pager button)').forEach((el) => { if (!el.closest('.pager')) el.disabled = true; });
  }
  function infoTab(p) {
    const s = st.s;
    const title = ui.input({ value: s.title, max: 30, placeholder: '예: 시장 구경 (중급)', onInput: (e) => { s.title = e.target.value; mark(); } });
    const topic = ui.select(st.topics.map((t) => ({ value: t.id, label: t.name })), s.topicId, (v) => { s.topicId = v; mark(); }, '주제');
    const level = ui.segmented(L.levels.map((v) => ({ value: v, label: L.level[v] })), s.level, (v) => { s.level = v; mark(); }, '수준');
    const desc = ui.input({ value: s.description, max: 100, placeholder: '설명(선택)', onInput: (e) => { s.description = e.target.value; mark(); } });
    const tags = ui.input({ value: (s.tags || []).join(', '), placeholder: '태그(선택, 쉼표로 구분)', onInput: (e) => { s.tags = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); mark(); } });
    p.appendChild(h('div', { class: 'form-grid one' },
      ui.field('제목', title, { field: 'title' }), ui.field('주제', topic, { field: 'topicId' }),
      h('div', { class: 'field' }, h('span', { class: 'label', text: '수준' }), h('div', { class: 'field-input' }, level)),
      ui.field('설명', desc, { field: 'description' }), ui.field('태그', tags, { field: 'tags' })));
  }
  function picLabel(w) {
    if (!w.image) return h('span', { class: 'muted', text: '그림 없음' });
    return HG.images.render(w.image, { cls: 'thumb', fallbackText: w.text });
  }
  function wordsTab(p, ro) {
    const s = st.s;
    const list = h('div', { class: 'list' });
    const pager = h('div');
    p.appendChild(list);
    p.appendChild(h('div', { class: 'btn-row' }, pager, ro ? null : ui.btn('낱말 추가', { icon: '＋', disabled: s.words.length >= 20, onClick: () => {
      s.words.push({ id: nextId(s.words, 'w'), text: '', image: null, hint: '', order: s.words.length }); mark();
      st.pages.words = s.words.length - 1; render();
      const inputs = st.view.querySelectorAll('[data-field$=".text"]'); if (inputs.length) inputs[inputs.length - 1].focus();
    } })));
    const pl = ui.pagedList({ list, pager, items: s.words, max: 6, render: (w, i) => {
      const f = 'words.' + i + '.';
      const text = ui.input({ value: w.text, max: 12, ariaLabel: (i + 1) + '번째 낱말', placeholder: '낱말', onInput: (e) => { w.text = e.target.value; mark(); } });
      text.dataset.field = f + 'text';
      text.id = 'wt' + i;
      const hint = ui.input({ value: w.hint, max: 30, ariaLabel: (i + 1) + '번째 힌트', placeholder: '힌트(선택)', onInput: (e) => { w.hint = e.target.value; mark(); } });
      hint.dataset.field = f + 'hint';
      hint.id = 'wh' + i;
      const pic = h('button', { type: 'button', class: 'btn btn-secondary pic-btn', 'aria-label': (i + 1) + '번째 낱말 그림 고르기', on: { click: async () => {
        const r = await pickImage(w);
        if (r === undefined) return;
        w.image = r; mark(); render();
      } } }, picLabel(w));
      const move = (d) => { const j = i + d; [s.words[i], s.words[j]] = [s.words[j], s.words[i]]; s.words.forEach((x, k) => { x.order = k; }); mark(); st.pages.words = j; render(); };
      return h('div', { class: 'word-row' },
        h('span', { class: 'step-no', text: String(i + 1) }),
        h('div', { class: 'field-input' }, text, h('div', { class: 'field-error', id: 'wt' + i + '-err' })), pic,
        h('div', { class: 'field-input' }, hint, h('div', { class: 'field-error', id: 'wh' + i + '-err' })),
        ro ? null : h('div', { class: 'btn-row nowrap' },
          ui.btn('', { icon: '▲', ariaLabel: '위로', disabled: i === 0, onClick: () => move(-1) }),
          ui.btn('', { icon: '▼', ariaLabel: '아래로', disabled: i === s.words.length - 1, onClick: () => move(1) }),
          ui.btn('', { icon: '✕', ariaLabel: '빼기', variant: 'danger', onClick: () => { s.words.splice(i, 1); s.words.forEach((x, k) => { x.order = k; }); mark(); render(); } })));
    } });
    pl.showIndex(st.pages.words || 0);
  }
  function sentTab(p, ro) {
    const s = st.s;
    const list = h('div', { class: 'list' });
    const pager = h('div');
    p.appendChild(list);
    p.appendChild(h('div', { class: 'btn-row' }, pager, ro ? null : ui.btn('문장 추가', { icon: '＋', disabled: s.sentences.length >= 12, onClick: () => {
      s.sentences.push({ id: nextId(s.sentences, 's'), text: '', answer: '', distractors: ['', ''], order: s.sentences.length }); mark();
      st.pages.sentences = s.sentences.length - 1; render();
    } })));
    if (!s.sentences.length) list.appendChild(ui.emptyState('문장이 없습니다. 문장이 있어야 빈칸 문장 활동을 할 수 있습니다.'));
    const pl = ui.pagedList({ list, pager, items: s.sentences, max: 3, render: (x, i) => {
      const f = 'sentences.' + i + '.';
      const mk = (val, ph, key, max, set) => {
        const el = ui.input({ value: val, max, placeholder: ph, ariaLabel: (i + 1) + '번째 ' + ph, onInput: (e) => { set(e.target.value); mark(); } });
        el.dataset.field = f + key;
        el.id = 's' + i + key;
        return h('div', { class: 'field-input' }, el, h('div', { class: 'field-error', id: el.id + '-err' }));
      };
      const d = mk(x.distractors[0] || '', '다른 보기 1', 'distractors', 10, (v) => { x.distractors[0] = v; });
      const d2 = ui.input({ value: x.distractors[1] || '', max: 10, placeholder: '다른 보기 2', ariaLabel: (i + 1) + '번째 다른 보기 2', onInput: (e) => { x.distractors[1] = e.target.value; mark(); } });
      return h('div', { class: 'card sent-row' },
        h('div', { class: 'sent-line' }, h('span', { class: 'step-no', text: String(i + 1) }), mk(x.text, '완성 문장 (예: 시장에서 사과를 샀어요.)', 'text', 40, (v) => { x.text = v; })),
        h('div', { class: 'sent-line' }, mk(x.answer, '정답 낱말', 'answer', 10, (v) => { x.answer = v; }), d, h('div', { class: 'field-input' }, d2),
          ro ? null : ui.btn('', { icon: '✕', ariaLabel: (i + 1) + '번째 문장 빼기', variant: 'danger', onClick: () => { s.sentences.splice(i, 1); s.sentences.forEach((y, k) => { y.order = k; }); mark(); render(); } })));
    } });
    if (s.sentences.length) pl.showIndex(st.pages.sentences || 0);
  }
  function optTab(p, ro) {
    const o = st.s.activityOptions;
    const av = V.availability(st.s);
    const row = (act, extra) => h('div', { class: 'card opt-row' },
      h('div', { class: 'opt-head' }, ui.toggle(L.activityIcon[act] + ' ' + L.activityShort[act], o[act].enabled !== false, (v) => { o[act].enabled = v; mark(); }),
        h('span', { class: av[act] ? 'ok' : 'muted', text: av[act] ? '사용 가능' : av.reason[act] })), extra);
    p.appendChild(h('div', { class: 'opt-grid' },
      row('trace', h('div', { class: 'opt-ctrls' },
        ui.segmented([{ value: 'cross', label: '십자 칸' }, { value: 'plain', label: '빈 칸' }], o.trace.gridStyle, (v) => { o.trace.gridStyle = v; mark(); }, '칸 모양'),
        ui.stepper({ label: '반복 쓰기', value: o.trace.repeat, min: 1, max: 3, step: 1, format: (v) => v + '번 쓰기', onChange: (v) => { o.trace.repeat = v; mark(); } }))),
      row('chosung', h('div', { class: 'opt-ctrls' },
        ui.segmented([{ value: 3, label: '보기 3개' }, { value: 4, label: '보기 4개' }], o.chosung.optionCount, (v) => { o.chosung.optionCount = v; mark(); }, '보기 수'),
        ui.toggle('그림 힌트', o.chosung.showImageHint !== false, (v) => { o.chosung.showImageHint = v; mark(); }))),
      row('match', h('div', { class: 'opt-ctrls' },
        ui.segmented([{ value: 3, label: '한 번에 3쌍' }, { value: 4, label: '한 번에 4쌍' }], o.match.pairsPerRound, (v) => { o.match.pairsPerRound = v; mark(); }, '한 번에 짝 수'))),
      row('blank', null)));
    if (ro) return;
  }
  /** 그림 고르기 대화상자. undefined=취소, null=그림 없음 */
  async function pickImage(w) {
    const assets = (await HG.db.getAll('assets')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    let result;
    const emoji = ui.input({ value: w.image && w.image.kind === 'emoji' ? w.image.ref : '', max: 8, placeholder: '예: 🍎', ariaLabel: '이모지 입력' });
    const grid = h('div', { class: 'pick-grid' });
    const pager = h('div');
    const body = h('div', { class: 'pick-body' },
      h('div', { class: 'field' }, h('label', { for: emoji.id || (emoji.id = 'emoji-in'), text: '이모지' }), h('div', { class: 'field-input' }, emoji)),
      h('p', { class: 'label', text: '등록한 그림' }), grid, pager);
    return HG.dialog.open({
      title: "'" + (w.text || '낱말') + "' 그림 고르기", wide: true, body,
      actions: [
        { label: '취소', value: undefined, focus: true },
        { label: '그림 없음', value: null },
        { label: '이모지 사용', variant: 'primary', value: () => { const v = V.clean(emoji.value); return v ? { kind: 'emoji', ref: Array.from(v).slice(0, 4).join(''), alt: V.clean(w.text) } : undefined; } }
      ],
      onOpen: (dlg, close) => {
        ui.pagedList({ list: grid, pager, items: assets, max: 8,
          empty: () => h('p', { class: 'muted', text: '등록한 그림이 없습니다. [관리자 설정 → 그림 자료]에서 등록해 주세요.' }),
          render: (a) => h('button', { type: 'button', class: 'pick-item', 'aria-label': a.label, on: { click: () => close({ kind: 'asset', ref: a.id, alt: a.label }) } },
            HG.images.render({ kind: 'asset', ref: a.id, alt: a.label }, { cls: 'thumb' }), h('span', { text: a.label })) }).draw();
      }
    }).then((v) => (result = v));
  }
  async function save() {
    const s = st.s;
    s.title = V.clean(s.title);
    s.description = V.clean(s.description);
    s.words.forEach((w, i) => { w.text = V.clean(w.text); w.hint = V.clean(w.hint); w.order = i; if (w.image) w.image.alt = w.image.alt || w.text; });
    s.sentences.forEach((x, i) => { x.text = V.clean(x.text); x.answer = V.clean(x.answer); x.distractors = [V.clean(x.distractors[0]), V.clean(x.distractors[1])]; x.order = i; });
    const r = V.problemSet(s, { topicIds: st.topics.map((t) => t.id) });
    st.errors = r.errors;
    st.warnings = r.warnings;
    if (r.errors.length) {
      const e = r.errors[0];
      st.tab = e.tab;
      const m = e.field.match(/^(words|sentences)\.(\d+)/);
      if (m) st.pages[m[1]] = Number(m[2]);
      render();
      HG.feedback.announce('고칠 내용이 ' + r.errors.length + '건 있습니다.');
      return;
    }
    if (r.warnings.length) {
      const ok = await HG.dialog.confirm('확인해 주세요', r.warnings.slice(0, 4).map((w) => '• ' + w.msg).join('\n') + (r.warnings.length > 4 ? '\n외 ' + (r.warnings.length - 4) + '건' : '') + '\n그대로 저장할까요?', { ok: '그대로 저장', cancel: '다시 고치기' });
      if (!ok) { st.tab = r.warnings[0].tab; render(); return; }
    }
    const texts = [s.title, s.description].concat(s.words.map((w) => w.hint), s.sentences.map((x) => x.text));
    if (!(await HG.privacy.confirmSave(texts))) return;
    try {
      await HG.db.put('problemSets', HG.repo.touch(s, st.isNew));
    } catch (e) {
      await HG.dialog.alert('저장하지 못했습니다', '저장 공간이 부족하거나 브라우저 설정 문제일 수 있습니다. 백업 후 다시 시도해 주세요.');
      return;
    }
    st.dirty = false;
    st.errors = []; st.warnings = [];
    HG.toast.show('저장했습니다.');
    HG.router.go('/admin/sets');
  }
  async function canLeave() {
    if (!st || !st.dirty) return true;
    const ok = await HG.dialog.confirm('저장하지 않은 내용', '저장하지 않은 내용이 있습니다. 그래도 나갈까요?', { ok: '나가기', cancel: '계속 편집' });
    if (ok) st.dirty = false;
    return ok;
  }
  HG.screens.adminSetEdit = { mount, canLeave, unmount() { st = null; } };
})();
