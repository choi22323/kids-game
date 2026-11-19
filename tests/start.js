/* 테스트용 DB로 열고 실행 */
(async function () {
  'use strict';
  await HG.db.open('hangul-classroom-test');
  await HG.db.deleteDatabase();
  await HG.db.open('hangul-classroom-test');
  await HG.repo.loadSettings();
  await HG.seed.install(true);
  await window.runTests();
})();
