/* S-19 백업·복원·세트 공유·기록 정리 (FEATURES.md F-15, F-19) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui, F = HG.format, B = HG.backup;

  async function mount(view) {
    const s = HG.state.settings;
    const [lastBackup, lastRestore, recs] = await Promise.all([HG.repo.getMeta('lastBackupAt'), HG.repo.getMeta('lastRestoreAt'), HG.db.getAll('activityRecords')]);
    const cutoff = s.recordRetentionMonths ? F.monthsAgoISO(s.recordRetentionMonths) : null;
    const old = cutoff ? recs.filter((r) => r.startedAt < cutoff) : [];
    const opts = { includeRecords: true, includeImages: true };
    const fileIn = (fn) => { const i = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' }); i.addEventListener('change', () => { const f = i.files[0]; i.value = ''; if (f) fn(f); }); return i; };
    const restoreIn = fileIn(restoreFlow), setsIn = fileIn(importFlow);

    const scr = ui.screen('백업·복원', [ui.btn('관리자 설정', { icon: '◀', onClick: () => HG.router.go('/admin') })]);
    scr.body.append(restoreIn, setsIn);
    view.appendChild(scr.el);
    ui.pagedNodes(scr.body, [
      h('div', { class: 'card' }, h('h2', { text: '💾 백업 파일 저장' }),
        h('p', { text: lastBackup ? '마지막 백업: ' + F.dateTimeLabel(lastBackup) : '아직 백업한 적이 없습니다.' }),
        h('div', { class: 'btn-row' }, ui.toggle('활동 기록 포함', true, (v) => { opts.includeRecords = v; }), ui.toggle('그림 포함', true, (v) => { opts.includeImages = v; })),
        h('div', { class: 'btn-row' }, ui.btn('백업 파일 저장', { variant: 'primary', onClick: doBackup })),
        h('p', { class: 'notice small', text: '⚠ 백업 파일은 암호화되지 않습니다. 기관 USB나 기관 공유 폴더에 보관하세요.' })),
      h('div', { class: 'card' }, h('h2', { text: '♻ 백업에서 복원' }),
        h('p', { text: lastRestore ? '마지막 복원: ' + F.dateTimeLabel(lastRestore) : '백업 파일로 자료를 되살립니다.' }),
        h('div', { class: 'btn-row' }, ui.btn('백업 파일 고르기', { variant: 'primary', onClick: () => restoreIn.click() })),
        h('p', { class: 'muted small', text: '손상되었거나 다른 프로그램의 파일은 복원되지 않으며, 이때 기존 자료는 그대로 유지됩니다.' })),
      h('div', { class: 'card' }, h('h2', { text: '🤝 문제 세트 나누기' }),
        h('p', { text: '필요한 세트만 파일로 만들어 다른 반·다른 기기와 나눕니다.' }),
        h('div', { class: 'btn-row' }, ui.btn('세트 파일로 내보내기', { onClick: exportFlow }), ui.btn('세트 파일 가져오기', { onClick: () => setsIn.click() }))),
      h('div', { class: 'card danger-zone' }, h('h2', { text: '🧹 기록 정리 · 초기화' }),
        h('p', { text: s.recordRetentionMonths ? s.recordRetentionMonths + '개월이 지난 활동 기록: ' + old.length + '건' : '보존 기간 안내가 꺼져 있습니다.' }),
        h('div', { class: 'btn-row' },
          ui.btn('오래된 기록 정리', { disabled: !old.length, onClick: () => purge(old, '오래된 활동 기록 ' + old.length + '건') }),
          ui.btn('모든 기록 지우기', { variant: 'danger', disabled: !recs.length, onClick: () => purge(recs, '모든 활동 기록 ' + recs.length + '건', true) }),
          ui.btn('모든 데이터 지우기', { variant: 'danger', onClick: wipe })))], 4, 'paged-grid2');

    async function doBackup() {
      try {
        const r = await B.saveBackup(opts);
        await HG.dialog.alert('백업 파일을 저장했습니다', r.name + '\n세트 ' + r.counts.problemSets + '개, 그림 ' + r.counts.assets + '개, 수업 계획 ' + r.counts.lessons + '개, 기록 ' + r.counts.activityRecords + '건\n브라우저의 다운로드 폴더를 확인해 주세요.');
        HG.router.rerender();
      } catch (e) { console.error(e); HG.dialog.alert('백업하지 못했습니다', '백업 파일을 만드는 중 문제가 생겼습니다.'); }
    }
    async function restoreFlow(file) {
      const r = await B.readFile(file, B.FORMAT);
      if (!r.ok) {
        await HG.dialog.alert('복원할 수 없습니다', r.error + (r.problems ? '\n' + r.problems.slice(0, 3).map((p) => '• ' + p).join('\n') : '') + '\n기존 자료는 그대로입니다.');
        return;
      }
      let mode = 'replace', safety = true;
      const c = r.counts;
      const body = h('div', null,
        h('p', { text: '백업 일시: ' + F.dateTimeLabel(r.exportedAt) }),
        h('p', { text: '세트 ' + c.problemSets + '개 · 주제 ' + c.topics + '개 · 그림 ' + c.assets + '개 · 수업 계획 ' + c.lessons + '개 · 기록 ' + c.activityRecords + '건' }),
        h('p', { class: 'label', text: '복원 방식' }),
        ui.segmented([{ value: 'replace', label: '전체 교체' }, { value: 'merge', label: '병합' }], mode, (v) => { mode = v; note.textContent = v === 'replace' ? '지금 자료를 백업 내용으로 바꿉니다. (기본 자료는 유지)' : '지금 자료에 백업 내용을 더합니다. 같은 자료는 더 최근 것을 남깁니다.'; }, '복원 방식'),
        h('p', { class: 'muted', text: '' }),
        ui.toggle('복원 전에 지금 자료를 안전 백업으로 저장', true, (v) => { safety = v; }));
      const note = body.children[4];
      note.textContent = '지금 자료를 백업 내용으로 바꿉니다. (기본 자료는 유지)';
      const ok = await HG.dialog.open({ title: '백업에서 복원', body, wide: true, actions: [{ label: '취소', value: false, focus: true }, { label: '복원하기', value: true, variant: 'primary' }] });
      if (!ok) return;
      try {
        if (safety) await B.saveBackup({ includeRecords: true, includeImages: true });
        const counts = await B.restore(r, mode);
        HG.applySettings();
        await HG.dialog.alert('복원했습니다', '세트 ' + counts.problemSets + '개, 그림 ' + counts.assets + '개, 수업 계획 ' + counts.lessons + '개, 기록 ' + counts.activityRecords + '건');
      } catch (e) {
        console.error(e);
        await HG.dialog.alert('복원하지 못했습니다', '복원 중 문제가 생겨 취소했습니다. 기존 자료는 그대로입니다.');
      }
      HG.router.rerender();
    }
    async function exportFlow() {
      const [sets, topics] = await Promise.all([HG.repo.sets(), HG.repo.topicsMap()]);
      sets.sort((a, b) => Number(a.isBuiltIn) - Number(b.isBuiltIn) || a.title.localeCompare(b.title));
      const chosen = new Set();
      const list = h('div', { class: 'pick-list' });
      const pager = h('div');
      const ok = await HG.dialog.open({ title: '내보낼 세트 고르기', wide: true, body: h('div', { class: 'pick-body' }, list, pager),
        actions: [{ label: '취소', value: false, focus: true }, { label: '내보내기', value: true, variant: 'primary' }],
        onOpen: () => ui.pagedList({ list, pager, items: sets, max: 6, render: (s) => ui.toggle(s.title + ' · ' + (topics[s.topicId] ? topics[s.topicId].name : ''), chosen.has(s.id), (v) => { if (v) chosen.add(s.id); else chosen.delete(s.id); }) }).draw() });
      if (!ok) return;
      if (!chosen.size) { await HG.dialog.alert('세트를 고르지 않았습니다', '내보낼 세트를 한 개 이상 골라 주세요.'); return; }
      const obj = await B.buildSetsFile(Array.from(chosen));
      B.download(obj, '한글교실_세트_' + F.stamp() + '.json');
      HG.toast.show('세트 ' + chosen.size + '개를 파일로 내보냈습니다.');
    }
    async function importFlow(file) {
      const r = await B.readFile(file, B.SETS_FORMAT);
      if (!r.ok) { await HG.dialog.alert('가져올 수 없습니다', r.error + (r.problems ? '\n' + r.problems.slice(0, 3).map((p) => '• ' + p).join('\n') : '')); return; }
      if (!(await HG.dialog.confirm('세트 파일 가져오기', '세트 ' + r.counts.problemSets + '개, 그림 ' + r.counts.assets + '개를 가져옵니다.\n기존 자료는 바뀌지 않고 새 세트로 추가됩니다.', { ok: '가져오기' }))) return;
      const res = await B.importSets(r);
      HG.toast.show('세트 ' + res.sets + '개를 가져왔습니다.');
      HG.router.rerender();
    }
    async function purge(list, label, strong) {
      const msg = label + '을(를) 지웁니다. 지운 기록은 되살릴 수 없습니다.\n먼저 백업해 두는 것을 권장합니다.';
      const ok = strong ? await HG.dialog.typeToConfirm('기록 지우기', msg, '기록 지우기', '지우기') : await HG.dialog.confirm('기록 정리', msg, { ok: '정리하기', danger: true });
      if (!ok) return;
      await HG.db.write(['activityRecords'], (tx) => list.forEach((r) => tx.objectStore('activityRecords').delete(r.id)));
      HG.toast.show(list.length + '건을 정리했습니다.');
      HG.router.rerender();
    }
    async function wipe() {
      if (await HG.dialog.confirm('먼저 백업할까요?', '모든 데이터를 지우기 전에 지금 자료를 백업 파일로 저장할 수 있습니다.', { ok: '백업하고 계속', cancel: '백업 없이 계속' })) {
        await B.saveBackup({ includeRecords: true, includeImages: true });
      }
      const ok = await HG.dialog.typeToConfirm('모든 데이터 지우기', '직접 만든 세트, 그림, 수업 계획, 기록, 설정이 모두 지워지고 기본 자료만 남습니다.', '모두 지우기', '모두 지우기');
      if (!ok) return;
      await B.wipeAll();
      HG.applySettings();
      HG.toast.show('모든 데이터를 지우고 기본 자료를 다시 설치했습니다.');
      HG.router.go('/home');
    }
  }
  HG.screens.adminBackup = { mount };
})();
