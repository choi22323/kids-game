/* 모든 화면 글자 점검 (개발용, 배포물 아님). 사용: node tests/e2e/text-audit.js
   화면 종류 × 모든 화면·상태(홈, 설정 탭, 대화상자, 소개, 쓰기, 정답 보기, 결과)에서
   - 잘리거나(…) 넘친 글자, 버튼 글자 잘림
   - 글자끼리 겹침
   - 너무 작은 글자(칠판 24px / 휴대폰·태블릿 15px 미만)
   - 정답 칸 글자가 문장과 정확히 같은지 (11개 문제 전부)
   - 제목에 같은 말이 반복되는지
   를 검사한다. */
const path = require('path');
const { chromium, devices } = require('playwright');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');

const TARGETS = [
  { name: '칠판 1920×1080', vp: { width: 1920, height: 1080 }, min: 23.5 },
  { name: '칠판 1366×768', vp: { width: 1366, height: 768 }, min: 23.5 },
  { name: '칠판 1280×720 글자 아주 크게', vp: { width: 1280, height: 720 }, min: 23.5, scale: 1.3 },
  { name: 'iPad Mini', dev: 'iPad Mini', min: 14.5 },
  { name: 'iPhone 13 세로', dev: 'iPhone 13', min: 14.5 },
  { name: 'iPhone 13 가로', dev: 'iPhone 13 landscape', min: 14.5 },
  { name: 'Galaxy S9+ 세로(320px)', dev: 'Galaxy S9+', min: 14.5 },
  { name: 'Galaxy S9+ 가로', dev: 'Galaxy S9+ landscape', min: 14.5 }
];

/** 화면 안 모든 글자 검사 (페이지 안에서 실행) */
function inspect(min) {
  const out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' && !el.closest('.sr-only, [hidden], #print-root, .feedback-layer'); };
  const textEls = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (!vis(el)) return;
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own) return;
    textEls.push(el);
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const label = '"' + own.slice(0, 18) + '"';
    if (fs < min && !el.closest('.trace-box.is-answer')) out.push('작은 글자 ' + fs + 'px ' + label);
    // 한 줄 말줄임·가로 잘림
    if ((cs.textOverflow === 'ellipsis' || cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 1) out.push('글자 잘림(가로) ' + label + ' ' + el.scrollWidth + '>' + el.clientWidth);
    // 화면 밖
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1) out.push('화면 밖 글자 ' + label);
    // 가장 가까운 잘라 내는 조상 밖으로 나감
    let p = el.parentElement;
    while (p && p !== document.body) {
      const pcs = getComputedStyle(p);
      if (pcs.overflow !== 'visible' || pcs.overflowX !== 'visible' || pcs.overflowY !== 'visible') {
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 1.5 || r.bottom > pr.bottom + 1.5 || r.left < pr.left - 1.5 || r.top < pr.top - 1.5) out.push('글자가 칸 밖으로 잘림 ' + label + ' (' + (p.className || p.tagName) + ')');
        break;
      }
      p = p.parentElement;
    }
  });
  // 버튼 안 글자 넘침
  document.querySelectorAll('button').forEach((b) => { if (vis(b) && (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1)) out.push('버튼 글자 넘침 "' + b.textContent.trim().slice(0, 16) + '"'); });
  // 글자끼리 겹침 (서로 조상·자손이 아닌 글자 요소)
  const rects = textEls.map((el) => {
    const range = document.createRange(); range.selectNodeContents(el);
    return { el, r: range.getBoundingClientRect() };
  }).filter((x) => x.r.width > 2 && x.r.height > 2);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.el.closest('.dialog-backdrop') !== b.el.closest('.dialog-backdrop')) continue;
    const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ix > 3 && iy > 3) out.push('글자 겹침 "' + a.el.textContent.trim().slice(0, 12) + '" ↔ "' + b.el.textContent.trim().slice(0, 12) + '"');
  }
  // 제목 반복
  document.querySelectorAll('.run-title, h1, h2').forEach((el) => {
    const parts = el.textContent.split('·').map((x) => x.trim()).filter(Boolean);
    for (let i = 1; i < parts.length; i++) if (parts[i].startsWith(parts[i - 1]) || parts[i - 1] === parts[i]) out.push('제목 반복 "' + el.textContent.trim() + '"');
  });
  return Array.from(new Set(out));
}

(async () => {
  const browser = await chromium.launch();
  let total = 0;
  const seen = new Map();
  for (const t of TARGETS) {
    const ctx = await browser.newContext(t.dev ? { ...devices[t.dev] } : { viewport: t.vp });
    const page = await ctx.newPage();
    page.setDefaultTimeout(5000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.addInitScript(() => {
      const v = { name: '시험 음성', lang: 'ko-KR', localService: true };
      speechSynthesis.getVoices = () => [v];
      speechSynthesis.speak = (u) => { setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => u.onend && u.onend(), 30); };
    });
    await page.goto(URL);
    await page.waitForFunction(() => window.HG && HG.state.settings && document.querySelector('.screen'));
    if (t.scale) await page.evaluate((s) => HG.repo.setSetting('fontScale', s), t.scale);
    const issues = [];
    const check = async (where) => {
      await page.waitForTimeout(150);
      (await page.evaluate(inspect, t.min)).forEach((x) => issues.push(where + ' · ' + x));
    };
    const go = async (h) => { await page.evaluate((x) => { location.hash = '#' + x; }, h); await page.waitForTimeout(350); };
    const click = async (sel) => { const l = page.locator(sel).first(); await l.click({ force: true }); await page.waitForTimeout(250); };

    await go('/home'); await check('홈');
    const pages = await page.locator('.pager-num').count();
    if (pages) { await click('.pager button:last-child'); await check('홈 2쪽'); }
    await go('/settings'); await check('설정 화면');
    for (const tab of ['읽어 주기·소리', '관리자 잠금']) { await page.locator('.tab', { hasText: tab }).click(); await page.waitForTimeout(250); await check('설정 ' + tab); }
    // 설정의 여러 쪽
    for (let k = 0; k < 3 && await page.locator('.paged-pager .pager button:last-child:not(:disabled)').count(); k++) { await click('.paged-pager .pager button:last-child'); await check('설정 다음 쪽'); }

    const sets = await page.evaluate(async () => (await HG.seed.dictationSets()).map((s) => ({ id: s.id, texts: s.sentences.slice().sort((a, b) => a.order - b.order).map((x) => x.text) })));
    for (const set of sets) {
      await go('/dictate/' + set.id);
      if (set === sets[0]) await check(set.id + ' 소개');
      await click('.run-bar [data-role=next]');
      for (let i = 0; i < set.texts.length; i++) {
        await page.waitForSelector('.trace-ink');
        const text = set.texts[i];
        const first = set === sets[0] || set.texts.length === 1;
        if (i === 0 && first) await check(set.id + ' 쓰기');
        // 한 획 쓰고 제출 → 정답 칸 확인
        const bb = await (await page.$('.trace-ink')).boundingBox();
        await page.mouse.move(bb.x + 8, bb.y + 8); await page.mouse.down(); await page.mouse.move(bb.x + 30, bb.y + 20); await page.mouse.up();
        await page.locator('.run-bar').getByRole('button', { name: '다 썼어요' }).click();
        await page.waitForTimeout(1750);
        const shown = await page.evaluate(() => {
          const ans = Array.from(document.querySelectorAll('.trace-box.is-answer')).map((x) => x.textContent || ' ').join('');
          const lab = Array.from(document.querySelectorAll('.dict-answer-label')).map((x) => x.textContent).join('|');
          return { ans, lab, mine: document.querySelectorAll('.trace-box:not(.is-answer)').length };
        });
        const want = Array.from(text.normalize('NFC').trim()).join('');
        const ok = shown.ans === want || (shown.ans === '' && shown.lab.includes(text));
        if (!ok) issues.push(set.id + ' ' + (i + 1) + '번 정답 불일치: 화면 "' + shown.ans + '" / 문장 "' + text + '"');
        if (shown.mine !== Array.from(want).length) issues.push(set.id + ' ' + (i + 1) + '번 칸 수 ' + shown.mine + ' ≠ ' + Array.from(want).length);
        if (first || i === 0) await check(set.id + ' ' + (i + 1) + '번 정답 보기');
        await click('.run-bar [data-role=next]');
      }
      await page.waitForSelector('.result');
      if (set === sets[0] || set === sets[sets.length - 1]) await check(set.id + ' 결과');
    }
    // 대화상자: 강사용 문장 보기, 나가기 확인
    await page.evaluate(() => { speechSynthesis.getVoices = () => []; HG.tts.pick(); });
    await go('/home');
    await go('/dictate/seed-woorimal-92');
    await click('.run-bar [data-role=next]');
    await page.waitForSelector('.trace-ink');
    const teacher = page.getByRole('button', { name: '강사용 문장 보기' });
    if (await teacher.count()) { await teacher.click(); await page.waitForTimeout(250); await check('강사용 문장 대화상자'); await page.keyboard.press('Escape'); }
    await check('음성 없음 안내');
    await ctx.close();
    const uniq = Array.from(new Set(issues));
    total += uniq.length + errs.length;
    console.log('[' + t.name + '] ' + (uniq.length || errs.length ? '' : '문제 없음'));
    uniq.slice(0, 25).forEach((x) => console.log('  - ' + x));
    if (uniq.length > 25) console.log('  … 외 ' + (uniq.length - 25) + '건');
    errs.forEach((e) => console.log('  오류: ' + e));
    uniq.forEach((x) => seen.set(x, (seen.get(x) || 0) + 1));
  }
  await browser.close();
  console.log(total ? '\n문제 ' + total + '건' : '\n모든 화면의 글자 점검 통과');
  process.exit(total ? 1 : 0);
})();
