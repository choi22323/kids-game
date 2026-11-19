/* S-14 관리자 설정 홈 */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui;
  const TILES = [
    ['/admin/sets', '📚', '문제 세트', '주제·수준별 문제 세트를 보고, 복제하고, 직접 만듭니다'],
    ['/admin/topics', '🗂', '주제', '학습 주제를 추가하고 순서를 바꿉니다'],
    ['/admin/images', '🖼', '그림 자료', '낱말 그림을 등록하고 관리합니다'],
    ['/admin/backup', '💾', '백업·복원', '자료를 파일로 저장하고 되살립니다'],
    ['/admin/display', '⚙', '화면·소리', '글자 크기, 소리, 필기 굵기, 관리자 PIN']
  ];
  async function mount(view) {
    const scr = ui.screen('관리자 설정', null, '강사용 메뉴입니다. 어르신 개인정보는 어디에도 입력하지 않습니다.');
    const list = h('div', { class: 'tile-grid admin-tiles' });
    scr.body.appendChild(list);
    view.appendChild(scr.el);
    ui.pagedList({ list, pager: scr.foot, items: TILES, max: 6, render: ([path, icon, name, desc]) =>
      h('button', { type: 'button', class: 'btn btn-secondary tile admin-tile', on: { click: () => HG.router.go(path) } },
        h('span', { class: 'btn-icon', 'aria-hidden': 'true', text: icon }), h('span', { class: 'strong', text: name }), h('span', { class: 'tile-sub', text: desc })) }).draw();
  }
  HG.screens.adminHome = { mount };
})();
