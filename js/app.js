/* 부트스트랩: DB 열기 → 설정 → 시드 → 라우터 (CLAUDE.md §4) */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const R = HG.router;

  R.add('/home', 'home', { section: 'home' });
  R.add('/dictate/:id', 'dictate', { run: true });
  R.add('/settings', 'adminDisplay', { section: 'settings', admin: true });

  HG.applySettings = function () {
    const s = HG.state.settings;
    document.documentElement.style.setProperty('--font-scale', String(s.fontScale));
    document.documentElement.classList.toggle('reduce-motion', HG.feedback.reducedMotion());
  };

  const NAV = [['/home', '🏠', '받아쓰기', 'home'], ['/settings', '⚙', '설정', 'settings']];
  function buildNav() {
    const nav = document.getElementById('mainnav');
    clear(nav);
    NAV.forEach(([path, icon, label, sec]) => nav.appendChild(h('a', { href: '#' + path, class: 'navlink', dataset: { sec } },
      h('span', { class: 'nav-icon', 'aria-hidden': 'true', text: icon }), h('span', { class: 'nav-label', text: label }))));
    HG.events.on('route', ({ section }) => {
      nav.querySelectorAll('.navlink').forEach((a) => { if (a.dataset.sec === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    });
  }
  function fatal(msg) {
    const view = document.getElementById('view');
    clear(view);
    view.appendChild(h('section', { class: 'boot' }, h('h1', { text: '처음 준비 중 문제가 생겼습니다' }), h('p', { text: msg }),
      HG.ui.btn('다시 시도', { variant: 'primary', onClick: () => location.reload() })));
  }
  async function boot() {
    const view = document.getElementById('view');
    view.appendChild(h('section', { class: 'boot' }, h('h1', { text: '수업 자료를 준비하고 있습니다' }), h('div', { class: 'boot-bar' }, h('span'))));
    try {
      await HG.db.open();
    } catch (e) {
      console.error(e);
      fatal('이 브라우저 설정에서는 자료를 저장할 수 없습니다. 시크릿(사생활 보호) 창이 아닌 일반 창에서, Chrome 또는 Edge로 열어 주세요.');
      return;
    }
    try {
      await HG.repo.loadSettings();
      HG.applySettings();
      await HG.seed.install(false);
      if (!(await HG.repo.getMeta('installedAt'))) await HG.repo.setMeta('installedAt', HG.format.nowISO());
      await HG.repo.setMeta('appVersion', HG.appVersion);
      await HG.repo.setMeta('schemaVersion', HG.db.SCHEMA_VERSION);
    } catch (e) {
      console.error(e);
      fatal('브라우저를 닫았다가 다시 열어 주세요. 계속되면 백업 파일로 복원해 주세요.');
      return;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((ok) => { HG.state.persisted = ok; }).catch(() => {});
    HG.events.on('settings', HG.applySettings);
    if (window.matchMedia) { const mq = matchMedia('(prefers-reduced-motion: reduce)'); if (mq.addEventListener) mq.addEventListener('change', HG.applySettings); }
    HG.audio.unlockOnGesture();
    buildNav();
    R.start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
