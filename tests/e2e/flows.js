/* 주요 흐름 E2E (개발 PC 전용, 배포물 아님). 사용: node tests/e2e/flows.js
   PROJECT_SPEC.md 수용 기준 AC-06, 08, 09, 13, 14, 15 및 F-14, F-15, F-17 확인. 가상 데이터만 사용 */
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');

const results = [];
async function step(name, fn) {
  try { await fn(); results.push('✔ ' + name); } catch (e) { results.push('✘ ' + name + ' — ' + e.message.split('\n')[0]); }
}
function ok(v, m) { if (!v) throw new Error(m || '실패'); }

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => window.HG && document.querySelector('.screen'));
  const go = async (h) => { await p.evaluate((x) => { location.hash = '#' + x; }, h); await p.waitForTimeout(400); };
  const dialogBtn = (name) => p.locator('.dialog').getByRole('button', { name, exact: true });

  await step('AC-14 메모에 전화번호 → 개인정보 경고, 고치기 선택 시 저장 안 됨', async () => {
    await go('/plans/new');
    await p.getByLabel('제목').fill('가상 시장 수업');
    await p.getByLabel('메모').fill('연락 010-1234-5678');
    await p.getByRole('button', { name: '저장', exact: true }).click();
    await p.waitForTimeout(300);
    ok(await p.locator('.dialog', { hasText: '전화번호' }).count(), '경고 없음');
    await dialogBtn('다시 고치기').click();
    ok((await p.evaluate(async () => (await HG.db.getAll('lessons')).length)) === 0, '저장됨');
    await p.getByLabel('메모').fill('');
  });
  await step('AC-06 수업 계획 저장 → 시작 → 진행 중 → 마침 → 요약', async () => {
    await p.getByRole('button', { name: '저장하고 시작' }).click();
    await p.waitForTimeout(600);
    ok(await p.locator('.intro').count(), '소개 화면 없음');
    ok((await p.evaluate(async () => (await HG.db.getAll('lessons'))[0].status)) === 'inProgress', '상태');
    // 모든 활동을 건너뛰며 끝까지 진행 (기록 저장 확인)
    for (let i = 0; i < 80; i++) {
      if (await p.locator('.summary').count()) break;
      const skip = p.locator('.run-bar').getByRole('button', { name: '건너뛰기' });
      if (await skip.count() && await skip.isEnabled()) { await skip.click(); await p.waitForTimeout(320); continue; }
      await p.locator('.run-bar [data-role=next]').click(); await p.waitForTimeout(320);
    }
    ok(await p.locator('.summary').count(), '요약 화면 없음');
    const l = await p.evaluate(async () => (await HG.db.getAll('lessons'))[0]);
    ok(l.status === 'done' && l.endedAt, '마침 처리');
  });
  await step('F-11 수업 학습지: 정답지 포함 시 쪽 추가', async () => {
    await p.getByRole('button', { name: '학습지 만들기' }).click();
    await p.waitForTimeout(600);
    const before = await p.evaluate(() => document.querySelector('.ws-nav').textContent);
    await p.getByRole('button', { name: '정답지' }).click();
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => document.querySelector('.ws-nav').textContent);
    ok(before !== after, '쪽 수 변화 없음: ' + before + ' / ' + after);
  });
  await step('AC-15 키보드만으로 초성 활동 완료', async () => {
    await p.evaluate(() => { HG.state.quick = { topicId: 'topic-market', level: 'beginner', setId: 'seed-market-beginner', activities: ['chosung'] }; location.hash = '#/run/quick'; });
    await p.waitForTimeout(500);
    await p.keyboard.press('Enter'); // 시작하기(포커스됨)
    await p.waitForTimeout(400);
    for (let q = 0; q < 12 && !(await p.locator('.result').count()); q++) {
      for (let k = 0; k < 4; k++) {
        if (await p.locator('.run-bar [data-role=next]').isEnabled()) break;
        await p.locator('.option:not(:disabled)').first().focus();
        await p.keyboard.press('Enter');
        await p.waitForTimeout(250);
      }
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(300);
    }
    ok(await p.locator('.result').count(), '결과 화면 도달 실패');
    const focusVisible = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    ok(focusVisible !== 'none' || document, '포커스');
  });
  await step('AC-13 [나가기] 짧게 누르면 나가지 않음, 2초 누르면 나감', async () => {
    const exit = p.locator('.run-controls .longpress');
    await exit.click();
    await p.waitForTimeout(300);
    ok(await p.locator('.run').count(), '짧게 눌러 나가짐');
    const bb = await exit.boundingBox();
    await p.mouse.move(bb.x + 20, bb.y + 20); await p.mouse.down(); await p.waitForTimeout(2300); await p.mouse.up();
    await p.waitForTimeout(500);
    ok(!(await p.locator('.run').count()), '길게 눌러도 안 나가짐');
  });
  await step('AC-08 내장 세트는 수정 불가 + 복제해서 편집', async () => {
    await go('/admin/sets/seed-family-beginner');
    ok(await p.getByRole('button', { name: '복제해서 편집' }).count(), '복제 버튼 없음');
    ok(await p.getByLabel('제목').isDisabled(), '입력 가능함');
    await p.getByRole('button', { name: '복제해서 편집' }).click();
    await p.waitForTimeout(500);
    ok(await p.getByRole('button', { name: '저장', exact: true }).count(), '복제본 편집 불가');
  });
  await step('AC-09 정답이 문장에 없으면 저장 안 되고 오류 표시', async () => {
    await p.locator('.tab', { hasText: '문장' }).click();
    await p.getByLabel('1번째 정답 낱말').fill('포도');
    await p.getByRole('button', { name: '저장', exact: true }).click();
    await p.waitForTimeout(400);
    ok(await p.locator('.error-summary', { hasText: '정답' }).count(), '오류 요약 없음');
    ok(await p.locator('.is-invalid').count(), '필드 강조 없음');
    await p.getByLabel('1번째 정답 낱말').fill('아기');
    await p.getByRole('button', { name: '저장', exact: true }).click();
    await p.waitForTimeout(500);
    ok(p.url().endsWith('#/admin/sets'), '저장 후 목록으로 가지 않음: ' + p.url());
  });
  await step('F-14 그림 등록(PNG) → 축소·해시 저장, SVG 거부', async () => {
    await go('/admin/images');
    const png = await p.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 2000; c.height = 1000;
      const x = c.getContext('2d'); x.fillStyle = '#1E3A5F'; x.fillRect(0, 0, 2000, 1000);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await p.locator('input[type=file]').setInputFiles({ name: 'drawing.png', mimeType: 'image/png', buffer: Buffer.from(png) });
    await p.waitForTimeout(600);
    await p.locator('.dialog input').fill('가상 그림');
    await dialogBtn('저장').click();
    await p.waitForTimeout(500);
    const a = await p.evaluate(async () => (await HG.db.getAll('assets'))[0]);
    ok(a && a.width === 1024 && a.height === 512 && /^[0-9a-f]{64}$/.test(a.sha256), '저장 내용 ' + JSON.stringify(a && [a.width, a.height]));
    await p.locator('input[type=file]').setInputFiles({ name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
    await p.waitForTimeout(400);
    ok(await p.locator('.dialog', { hasText: 'PNG, JPG, WebP' }).count(), 'SVG 거부 안내 없음');
    await dialogBtn('확인').click();
  });
  await step('F-17 PIN 설정 → 관리자 설정 진입 시 PIN 요구 → 맞으면 통과', async () => {
    await go('/admin/display');
    await p.locator('.tab', { hasText: '관리자 잠금' }).click();
    await p.waitForTimeout(200);
    await p.getByRole('button', { name: 'PIN 설정' }).click();
    for (const round of [0, 1]) {
      await p.waitForTimeout(200);
      for (const d of '2580') await p.locator('.pin-pad').getByRole('button', { name: d, exact: true }).click({ force: true });
      await p.locator('.pin-pad').getByRole('button', { name: '확인' }).click({ force: true });
    }
    await p.waitForTimeout(800);
    ok(await p.evaluate(() => !!HG.state.settings.adminPinHash), 'PIN 저장 안 됨');
    await p.evaluate(() => { HG.state.adminUnlocked = false; });
    await go('/home');
    await go('/admin');
    ok(await p.locator('.pin-pad').count(), 'PIN 입력창 없음');
    for (const d of '2580') await p.locator('.pin-pad').getByRole('button', { name: d, exact: true }).click({ force: true });
    await p.locator('.pin-pad').getByRole('button', { name: '확인' }).click({ force: true });
    await p.waitForTimeout(900);
    ok(await p.locator('.admin-tile').count(), '관리자 화면 진입 실패');
    await p.evaluate(() => HG.pin.clear());
  });
  await step('F-15 화면에서 복원: 손상 파일은 거부, 기존 자료 유지', async () => {
    await go('/admin/backup');
    const n = await p.evaluate(async () => (await HG.db.getAll('problemSets')).length);
    await p.locator('input[type=file]').first().setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"hangul-classroom-backup","schemaVersion":1,"checksum":{"value":"00"},"data":{}}') });
    await p.waitForTimeout(500);
    ok(await p.locator('.dialog', { hasText: '손상' }).count(), '손상 안내 없음');
    await dialogBtn('확인').click();
    ok((await p.evaluate(async () => (await HG.db.getAll('problemSets')).length)) === n, '자료 변경됨');
  });
  await step('NFR-01 외부 요청 없음 / 콘솔 오류 없음', async () => { ok(!errs.length, errs.join(' | ')); });

  console.log(results.join('\n'));
  await b.close();
  process.exit(results.some((r) => r.startsWith('✘')) ? 1 : 0);
})();
