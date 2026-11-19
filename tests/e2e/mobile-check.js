const { chromium, devices } = require('playwright');
/* 휴대폰·태블릿 화면 점검 (개발용, 배포물 아님). 사용: node tests/e2e/mobile-check.js
   iPhone 13 세로/가로, Galaxy S9+(320px), iPad Mini에서 홈·설정·받아쓰기·정답 보기의 넘침·작은 버튼을 검사한다. */
const path = require('path');
const S = require('os').tmpdir() + '/';
(async () => {
  const b = await chromium.launch();
  const list = [['iPhone 13', 'iphone'], ['iPhone 13 landscape', 'iphone-l'], ['Galaxy S9+', 'galaxy'], ['iPad Mini', 'ipad']];
  for (const [dev, name] of list) {
    const ctx = await b.newContext({ ...devices[dev] });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { const v = { name: '시험 음성', lang: 'ko-KR', localService: true }; speechSynthesis.getVoices = () => [v]; speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 20); });
    await p.goto('file://' + path.resolve(__dirname, '../../index.html'));
    await p.waitForTimeout(700);
    const check = () => p.evaluate(() => {
      const de = document.documentElement; const out = [];
      if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) out.push('페이지 넘침 ' + de.scrollWidth + 'x' + de.scrollHeight + ' > ' + innerWidth + 'x' + innerHeight);
      document.querySelectorAll('#view *').forEach((el) => { const cs = getComputedStyle(el); if (cs.overflow === 'hidden' && el.clientHeight > 0 && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) && !el.closest('.dict-row') && !el.classList.contains('dict-info') && !el.closest('.row-info') && !el.classList.contains('sr-only')) out.push('잘림 ' + el.className + ' ' + el.scrollWidth + 'x' + el.scrollHeight + '>' + el.clientWidth + 'x' + el.clientHeight); });
      document.querySelectorAll('#view .btn').forEach((x) => { const r = x.getBoundingClientRect(); if (x.offsetParent && r.height < 43.5) out.push('작은 버튼 ' + Math.round(r.height) + ' ' + x.textContent.trim().slice(0, 8)); if (x.offsetParent && (r.right > innerWidth + 1 || r.left < -1)) out.push('화면 밖 버튼 ' + x.textContent.trim().slice(0, 8)); });
      return Array.from(new Set(out)).slice(0, 6);
    });
    const report = [];
    report.push('홈 ' + JSON.stringify(await check()));
    await p.screenshot({ path: S + 'm-' + name + '-home.png' });
    await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(400);
    report.push('설정 ' + JSON.stringify(await check()));
    await p.evaluate(() => { location.hash = '#/dictate/seed-woorimal-92'; }); await p.waitForTimeout(400);
    await p.tap('.run-bar [data-role=next]'); await p.waitForSelector('.trace-ink'); await p.waitForTimeout(400);
    const box1 = await p.evaluate(() => Math.round(document.querySelector('.trace-box').getBoundingClientRect().width));
    report.push('받아쓰기(칸 ' + box1 + 'px) ' + JSON.stringify(await check()));
    await p.screenshot({ path: S + 'm-' + name + '-write.png' });
    // 터치로 한 획
    const bb = await (await p.$('.trace-ink')).boundingBox();
    await p.touchscreen.tap(bb.x + 10, bb.y + 10);
    await p.mouse.move(bb.x + 8, bb.y + 12); await p.mouse.down(); await p.mouse.move(bb.x + 30, bb.y + 25); await p.mouse.up();
    await p.tap('.run-bar [data-role=next]'); await p.waitForTimeout(1900);
    const mode = await p.evaluate(() => (document.querySelector('.trace-box.is-answer') ? '아래 정답 칸' : '겹쳐 보기') + ' / 칸 ' + Math.round(document.querySelector('.trace-box').getBoundingClientRect().width) + 'px');
    report.push('정답 보기(' + mode + ') ' + JSON.stringify(await check()));
    await p.screenshot({ path: S + 'm-' + name + '-answer.png' });
    console.log('[' + dev + ' ' + p.viewportSize().width + 'x' + p.viewportSize().height + ']\n  ' + report.join('\n  ') + (errs.length ? '\n  오류: ' + errs.join(' ') : ''));
    await ctx.close();
  }
  await b.close();
})();
