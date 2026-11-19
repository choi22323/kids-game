/* tests/test.html 을 헤드리스로 실행해 결과 출력 (개발용). 사용: node tests/e2e/run-unit.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../test.html'));
  await p.waitForFunction(() => window.__results, null, { timeout: 60000 });
  const r = await p.evaluate(() => window.__results);
  console.log('통과 ' + r.pass + ' / 실패 ' + r.fail);
  r.failures.forEach((f) => console.log('  ✘ ' + f));
  errs.forEach((e) => console.log('  오류: ' + e));
  await b.close();
  process.exit(r.fail || errs.length ? 1 : 0);
})();
