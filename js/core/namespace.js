/* 전역 네임스페이스. 가장 먼저 로드한다. (CLAUDE.md §3: ES Module 미사용) */
(function () {
  'use strict';
  const listeners = {};
  window.HG = {
    appVersion: '1.0.0',
    state: { settings: null, adminUnlocked: false, quick: null, lastRun: null },
    activities: {},
    screens: {},
    ui: {},
    events: {
      on(name, fn) {
        (listeners[name] = listeners[name] || []).push(fn);
        return () => { listeners[name] = (listeners[name] || []).filter((f) => f !== fn); };
      },
      emit(name, data) {
        (listeners[name] || []).slice().forEach((fn) => {
          try { fn(data); } catch (e) { console.error(e); }
        });
      }
    }
  };
})();
