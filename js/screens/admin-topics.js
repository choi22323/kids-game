/* S-17 주제 관리 (FEATURES.md F-13) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui, L = HG.labels, V = HG.validate;

  async function mount(view) {
    const [topics, sets] = await Promise.all([HG.repo.topics(), HG.repo.sets()]);
    const scr = ui.screen('주제', [ui.btn('관리자 설정', { icon: '◀', onClick: () => HG.router.go('/admin') }),
      ui.btn('새 주제', { variant: 'primary', icon: '＋', disabled: topics.length >= 20, onClick: () => edit(null) })]);
    const list = h('div', { class: 'list' });
    scr.body.appendChild(list);
    view.appendChild(scr.el);
    const count = (t) => sets.filter((s) => s.topicId === t.id).length;
    ui.pagedList({ list, pager: scr.foot, items: topics, max: 6, render: (t, i) => h('div', { class: 'card row-card' },
      h('div', { class: 'row-info' }, h('p', null, h('span', { class: 'topic-ic', 'aria-hidden': 'true', text: L.topicIcon[t.icon] + ' ' }), h('span', { class: 'strong', text: t.name }), ' ', t.isBuiltIn ? ui.badge('기본', 'gold') : null),
        h('p', { class: 'muted', text: '문제 세트 ' + count(t) + '개' })),
      h('div', { class: 'btn-row' },
        ui.btn('', { icon: '▲', ariaLabel: t.name + ' 위로', disabled: i === 0, onClick: () => move(i, -1) }),
        ui.btn('', { icon: '▼', ariaLabel: t.name + ' 아래로', disabled: i === topics.length - 1, onClick: () => move(i, 1) }),
        ui.btn('이름 바꾸기', { onClick: () => edit(t) }),
        t.isBuiltIn ? null : ui.btn('삭제', { variant: 'danger', onClick: () => remove(t) }))) }).draw();

    async function move(i, d) {
      const j = i + d;
      [topics[i], topics[j]] = [topics[j], topics[i]];
      await HG.db.write(['topics'], (tx) => topics.forEach((t, k) => { t.order = k; tx.objectStore('topics').put(HG.repo.touch(t)); }));
      HG.router.rerender();
    }
    async function remove(t) {
      const n = count(t);
      if (n) { await HG.dialog.alert('삭제할 수 없습니다', '이 주제에 세트 ' + n + '개가 있어 삭제할 수 없습니다. 세트를 다른 주제로 옮기거나 삭제해 주세요.'); return; }
      if (!(await HG.dialog.confirm('주제 삭제', "'" + t.name + "' 주제를 삭제할까요?", { ok: '삭제', danger: true }))) return;
      await HG.db.del('topics', t.id);
      HG.router.rerender();
    }
    async function edit(t) {
      const name = ui.input({ value: t ? t.name : '', max: 12, placeholder: '예: 명절·전통' });
      let icon = t ? t.icon : 'book';
      const icons = ui.segmented(L.topicIcons.map((k) => ({ value: k, label: L.topicIcon[k] })), icon, (v) => { icon = v; }, '아이콘');
      const err = h('p', { class: 'field-error', 'aria-live': 'polite' });
      const body = h('div', null, ui.field('주제 이름', name), h('p', { class: 'label', text: '아이콘' }), icons, err);
      for (;;) {
        const ok = await HG.dialog.open({ title: t ? '주제 이름 바꾸기' : '새 주제', body, wide: true, actions: [{ label: '취소', value: false }, { label: '저장', value: true, variant: 'primary' }], onOpen: () => setTimeout(() => name.focus(), 0) });
        if (!ok) return;
        const obj = t ? Object.assign({}, t, { name: V.clean(name.value), icon }) : { id: HG.ids.uuid(), name: V.clean(name.value), icon, order: topics.length, isBuiltIn: false };
        const r = V.topic(obj, topics);
        if (r.errors.length) { err.textContent = r.errors[0].msg; continue; }
        await HG.db.put('topics', HG.repo.touch(obj, !t));
        HG.toast.show('저장했습니다.');
        HG.router.rerender();
        return;
      }
    }
  }
  HG.screens.adminTopics = { mount };
})();
