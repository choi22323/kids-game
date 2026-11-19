const { chromium } = require('playwright');
/* 받아쓰기 흐름 E2E (개발 PC 전용, 배포물 아님). 사용: node tests/e2e/dictation.js
   음성 합성은 가짜로 바꿔 '무엇을 몇 번 읽었는지'를 확인한다. */
const path = require('path');
const os = require('os');
const S = os.tmpdir() + '/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // 음성 합성 흉내: 한국어 음성이 있는 것처럼 하고 읽은 문장을 기록
  await p.addInitScript(() => {
    window.__spoken = [];
    const fakeVoice = { name: '테스트 한국어', lang: 'ko-KR', localService: true };
    window.speechSynthesis.getVoices = () => [fakeVoice];
    window.speechSynthesis.speak = (u) => { window.__spoken.push([u.text, u.rate]); setTimeout(() => u.onstart && u.onstart(), 10); setTimeout(() => u.onend && u.onend(), 50); };
  });
  await p.goto('file://' + path.resolve(__dirname, '../../index.html'));
  await p.waitForTimeout(800);
  await p.screenshot({ path: S + 'd-home.png' });
  await p.getByRole('button', { name: '시작하기' }).first().click(); await p.waitForTimeout(400);
  await p.locator('.run-bar').getByRole('button', { name: '시작하기' }).click(); await p.waitForTimeout(800);
  console.log('자동 읽기:', JSON.stringify(await p.evaluate(() => window.__spoken)));
  await p.getByRole('button', { name: '다시 듣기' }).first().click(); await p.waitForTimeout(200);
  await p.getByRole('button', { name: '천천히 듣기' }).click(); await p.waitForTimeout(200);
  console.log('다시/천천히:', JSON.stringify(await p.evaluate(() => window.__spoken.slice(-2))));
  const bb = await (await p.$('.trace-ink')).boundingBox();
  await p.mouse.move(bb.x + 40, bb.y + 60); await p.mouse.down();
  for (let i = 0; i < 40; i++) await p.mouse.move(bb.x + 40 + i * 12, bb.y + 60 + Math.sin(i / 4) * 40);
  await p.mouse.up();
  await p.screenshot({ path: S + 'd-write.png' });
  await p.getByRole('button', { name: '다 썼어요' }).click(); await p.waitForTimeout(1800);
  console.log('정답 표시:', await p.locator('.dict-answer').textContent());
  await p.screenshot({ path: S + 'd-answer.png' });
  for (let i = 0; i < 12 && !(await p.locator('.result').count()); i++) {
    const nx = p.locator('.run-bar [data-role=next]');
    if ((await nx.textContent()).includes('다 썼어요')) await p.locator('.run-bar').getByRole('button', { name: '건너뛰기' }).click();
    else await nx.click();
    await p.waitForTimeout(450);
  }
  console.log('읽은 문장 수:', await p.evaluate(() => new Set(window.__spoken.map((x) => x[0])).size));
  await p.screenshot({ path: S + 'd-result.png' });
  console.log('기록:', JSON.stringify(await p.evaluate(async () => (await HG.db.getAll('activityRecords')).map((r) => [r.activity, r.totalQuestions, r.correctFirstTry, r.skipped, r.stars]))));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
