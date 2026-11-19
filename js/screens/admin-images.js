/* S-18 그림 자료 (FEATURES.md F-14) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui, V = HG.validate;

  async function mount(view) {
    const [assets, sets] = await Promise.all([HG.db.getAll('assets'), HG.repo.sets()]);
    assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const used = (a) => sets.filter((s) => s.words.some((w) => w.image && w.image.kind === 'asset' && w.image.ref === a.id));
    const file = h('input', { type: 'file', accept: HG.images.TYPES.join(','), class: 'sr-only', 'aria-hidden': 'true', tabindex: '-1' });
    file.addEventListener('change', () => { const f = file.files[0]; file.value = ''; if (f) upload(f); });
    const scr = ui.screen('그림 자료', [ui.btn('관리자 설정', { icon: '◀', onClick: () => HG.router.go('/admin') }),
      ui.btn('그림 등록', { variant: 'primary', icon: '＋', onClick: () => file.click() })]);
    const total = assets.reduce((a, x) => a + x.size, 0);
    const list = h('div', { class: 'thumb-grid' });
    scr.body.append(file,
      h('p', { class: 'notice', text: '⚠ 어르신 얼굴 사진 등 사람이 알아볼 수 있는 사진은 등록하지 마세요. 직접 그렸거나 사용 허락을 받은 그림만 등록해 주세요.' + (total > 100 * 1048576 ? ' (그림 용량이 100MB를 넘었습니다. 백업 후 정리해 주세요.)' : '') }),
      list);
    view.appendChild(scr.el);
    ui.pagedList({ list, pager: scr.foot, items: assets, max: 12,
      empty: () => ui.emptyState('등록한 그림이 없습니다. 직접 그리거나 사용 허락을 받은 그림만 등록해 주세요.', [ui.btn('그림 등록', { variant: 'primary', onClick: () => file.click() })]),
      render: (a) => h('div', { class: 'card thumb-card' },
        HG.images.render({ kind: 'asset', ref: a.id, alt: a.label }, { cls: 'thumb-lg' }),
        h('p', { class: 'strong', text: a.label }),
        h('p', { class: 'muted', text: '사용: 세트 ' + used(a).length + '개 · ' + Math.round(a.size / 1024) + 'KB' }),
        h('div', { class: 'btn-row' }, ui.btn('이름', { onClick: () => rename(a) }), ui.btn('삭제', { variant: 'danger', onClick: () => remove(a) }))) }).draw();

    async function askLabel(init) {
      const input = ui.input({ value: init || '', max: 30, placeholder: '예: 보건소 건물' });
      const err = h('p', { class: 'field-error', 'aria-live': 'polite' });
      const body = h('div', null, ui.field('이름표', input), h('p', { class: 'muted', text: '이름표는 그림을 볼 수 없는 경우 대신 읽어 주는 글(대체텍스트)로도 쓰입니다.' }), err);
      for (;;) {
        const ok = await HG.dialog.open({ title: '그림 이름표', body, actions: [{ label: '취소', value: false }, { label: '저장', value: true, variant: 'primary' }], onOpen: () => setTimeout(() => input.focus(), 0) });
        if (!ok) return null;
        const v = V.clean(input.value);
        if (V.len(v) < 1 || V.len(v) > 30) { err.textContent = '이름표는 1~30자로 입력해 주세요.'; continue; }
        if (!(await HG.privacy.confirmSave([v]))) continue;
        return v;
      }
    }
    async function upload(f) {
      const r = await HG.images.processUpload(f);
      if (!r.ok) { await HG.dialog.alert('그림을 등록할 수 없습니다', r.error); return; }
      const dup = (await HG.db.getAll('assets')).find((x) => x.sha256 === r.data.sha256);
      if (dup) { await HG.dialog.alert('이미 등록된 그림입니다', "같은 그림이 '" + dup.label + "' 이름으로 등록되어 있습니다."); return; }
      const label = await askLabel('');
      if (!label) return;
      try {
        await HG.db.put('assets', HG.repo.touch(Object.assign({ id: HG.ids.uuid(), label }, r.data), true));
      } catch (e) {
        await HG.dialog.alert('저장하지 못했습니다', '저장 공간이 부족할 수 있습니다. 백업 후 사용하지 않는 그림을 정리해 주세요.');
        return;
      }
      HG.toast.show('그림을 등록했습니다. 문제 세트 편집에서 낱말 그림으로 고를 수 있습니다.');
      HG.router.rerender();
    }
    async function rename(a) {
      const v = await askLabel(a.label);
      if (!v) return;
      a.label = v;
      await HG.db.put('assets', HG.repo.touch(a));
      HG.router.rerender();
    }
    async function remove(a) {
      const us = used(a);
      const msg = "'" + a.label + "' 그림을 삭제할까요?" + (us.length ? '\n사용 중인 세트: ' + us.slice(0, 3).map((s) => s.title).join(', ') + (us.length > 3 ? ' 외 ' + (us.length - 3) + '개' : '') + '\n삭제하면 해당 낱말은 그림 없이 표시됩니다.' : '');
      if (!(await HG.dialog.confirm('그림 삭제', msg, { ok: '삭제', danger: true }))) return;
      await HG.db.write(['assets', 'problemSets'], (tx) => {
        tx.objectStore('assets').delete(a.id);
        us.forEach((s) => { s.words.forEach((w) => { if (w.image && w.image.kind === 'asset' && w.image.ref === a.id) w.image = null; }); tx.objectStore('problemSets').put(HG.repo.touch(s)); });
      });
      HG.images.forget(a.id);
      HG.toast.show('삭제했습니다.');
      HG.router.rerender();
    }
  }
  HG.screens.adminImages = { mount, unmount() { /* objectURL 캐시는 재사용 */ } };
})();
