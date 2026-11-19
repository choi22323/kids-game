/* 개발 PC 전용 화면 점검 (배포물 아님). 사용: node tests/e2e/layout-check.js
   모든 화면 × 뷰포트 3종 × 글자 배율 3단계에서
   - 세로 스크롤/잘림(overflow hidden 상태의 넘침)
   - 버튼 높이 80px 미만, 글자 24px 미만
   - 콘솔 오류, 외부 요청
   을 검사한다. (CLAUDE.md §7-3, NFR-03/05/06) */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '../../index.html');
const VIEWPORTS = [[1920, 1080], [1366, 768], [1280, 720]];
const SCALES = [1, 1.15, 1.3];
const ROUTES = ['/home', '/settings', 'RUN:intro', 'RUN:dictation', 'RUN:result'];

async function check(page) {
  return page.evaluate(() => {
    const issues = [];
    const de = document.documentElement;
    if (de.scrollHeight > innerHeight + 1) issues.push('페이지 세로 스크롤 ' + de.scrollHeight + '>' + innerHeight);
    const view = document.getElementById('view');
    const skip = (el) => el.closest('.ws-scale, .ws-page, #print-root, .trace-row');
    view.querySelectorAll('*').forEach((el) => {
      if (skip(el)) return;
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'hidden' || cs.overflow === 'hidden') && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
        issues.push('잘림: ' + (el.className || el.tagName) + ' ' + el.scrollHeight + '>' + el.clientHeight);
      }
    });
    document.querySelectorAll('#view button, #view .btn, #view a.navlink').forEach((b) => {
      if (skip(b) || b.offsetParent === null) return;
      const r = b.getBoundingClientRect();
      if (r.height && r.height < 79.5 && !b.closest('.tabs')) issues.push('버튼 높이 ' + Math.round(r.height) + ': ' + b.textContent.trim().slice(0, 12));
    });
    view.querySelectorAll('p, span, label, li, td, th, h1, h2, button, input, select, output').forEach((el) => {
      if (skip(el) || el.offsetParent === null || !el.textContent.trim()) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 23.5) issues.push('글자 ' + fs + 'px: ' + el.textContent.trim().slice(0, 12));
    });
    return Array.from(new Set(issues)).slice(0, 8);
  });
}

(async () => {
  const browser = await chromium.launch();
  let total = 0;
  for (const [w, hgt] of VIEWPORTS) {
    for (const sc of SCALES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      page.on('request', (r) => { if (!/^(file|blob|data):/.test(r.url())) errs.push('외부 요청 ' + r.url()); });
      await page.goto(URL);
      await page.waitForFunction(() => window.HG && HG.state.settings && document.querySelector('.screen'));
      await page.evaluate(async (s) => { await HG.repo.setSetting('fontScale', s); }, sc);
      for (const r of ROUTES) {
        if (r.startsWith('RUN:')) {
          const act = r.slice(4);
          await page.evaluate(() => { location.hash = '#/home'; });
          await page.waitForTimeout(150);
          await page.evaluate(() => { location.hash = '#/dictate/seed-anthem-1'; });
          await page.waitForTimeout(350);
          if (act !== 'intro') { await page.click('.run-bar [data-role=next]'); await page.waitForTimeout(450); }
          if (act === 'result') {
            for (let i = 0; i < 10; i++) { await page.locator('.run-bar').getByRole('button', { name: '건너뛰기' }).click(); await page.waitForTimeout(150); }
            await page.waitForTimeout(300);
          }
        } else {
          await page.evaluate((h) => { location.hash = '#' + h; }, r);
          await page.waitForTimeout(350);
        }
        if (false) {
          for (const tab of ['낱말', '문장', '활동 옵션']) {
            await page.locator('.tab', { hasText: tab }).click();
            await page.waitForTimeout(200);
            const is = await check(page);
            if (is.length) { total += is.length; console.log(`[${w}x${hgt} x${sc}] ${r} 탭:${tab}\n  - ` + is.join('\n  - ')); }
          }
        }
        if (r === '/settings') {
          for (const tab of ['읽어 주기·소리', '관리자 잠금']) {
            await page.locator('.tab', { hasText: tab }).click();
            await page.waitForTimeout(250);
            const is = await check(page);
            if (is.length) { total += is.length; console.log(`[${w}x${hgt} x${sc}] ${r} 탭:${tab}\n  - ` + is.join('\n  - ')); }
          }
          await page.locator('.tab', { hasText: '화면' }).first().click();
          await page.waitForTimeout(200);
        }
        const is = await check(page);
        if (is.length) { total += is.length; console.log(`[${w}x${hgt} x${sc}] ${r}\n  - ` + is.join('\n  - ')); }
      }
      if (errs.length) { total += errs.length; console.log(`[${w}x${hgt} x${sc}] 오류:\n  - ` + Array.from(new Set(errs)).join('\n  - ')); }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(total ? '문제 ' + total + '건' : '모든 화면 통과');
  process.exit(total ? 1 : 0);
})();
