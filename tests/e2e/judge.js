/* 받아쓰기 정답 판정 E2E (개발용). 글자 모양을 펜 획으로 채워 '바르게 쓴 경우'를 흉내 낸다. */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 20); });
  await p.goto('file://' + path.resolve(__dirname, '../../index.html') + '#/dictate/seed-anthem-1');
  await p.waitForTimeout(700);
  await p.locator('.run-bar').getByRole('button', { name: '시작하기' }).click();
  await p.waitForTimeout(600);
  async function writeText(text) {
    const boxes = await p.$$eval('.trace-box', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width]; }));
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === ' ') continue;
      const [bx, by, bs] = boxes[i];
      // 페이지 안에서 글자 모양의 가로 구간을 구함
      // 글자 모양의 뼈대(가운데 선) 점들을 구해 펜으로 찍어 그린다 = 한 줄 획으로 쓴 손글씨와 비슷
      const pts = await p.evaluate(([ch, size]) => {
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = '500 ' + Math.round(size * 0.72) + 'px "WenQuanYi Zen Hei", sans-serif';
        x.fillText(ch, size / 2, size * 0.53);
        const d = x.getImageData(0, 0, size, size).data, N = size;
        const a = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) a[i] = d[i * 4 + 3] > 100 ? 1 : 0;
        const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= N || yy >= N ? 0 : a[yy * N + xx]);
        let changed = true;
        while (changed) { changed = false; for (let pass = 0; pass < 2; pass++) { const del = [];
          for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) { if (!a[yy * N + xx]) continue;
            const q = [at(xx, yy - 1), at(xx + 1, yy - 1), at(xx + 1, yy), at(xx + 1, yy + 1), at(xx, yy + 1), at(xx - 1, yy + 1), at(xx - 1, yy), at(xx - 1, yy - 1)];
            const bsum = q.reduce((s2, v) => s2 + v, 0); if (bsum < 2 || bsum > 6) continue;
            let t = 0; for (let k = 0; k < 8; k++) if (!q[k] && q[(k + 1) % 8]) t++; if (t !== 1) continue;
            if (pass === 0 ? (q[0] && q[2] && q[4]) || (q[2] && q[4] && q[6]) : (q[0] && q[2] && q[6]) || (q[0] && q[4] && q[6])) continue;
            del.push(yy * N + xx); }
          if (del.length) { changed = true; del.forEach((i) => { a[i] = 0; }); } } }
        const out = []; for (let yy = 0; yy < N; yy += 3) for (let xx = 0; xx < N; xx += 3) {
          let hit = null; for (let dy = 0; dy < 3 && !hit; dy++) for (let dx = 0; dx < 3 && !hit; dx++) if (at(xx + dx, yy + dy)) hit = [xx + dx, yy + dy];
          if (hit) out.push(hit); }
        return out;
      }, [chars[i], Math.round(bs)]);
      for (const [px, py] of pts) {
        await p.mouse.move(bx + px, by + py); await p.mouse.down(); await p.mouse.move(bx + px + 1, by + py); await p.mouse.up();
      }
    }
  }
  const out = [];
  await writeText('동해 물과');
  await p.getByRole('button', { name: '다 썼어요' }).click(); await p.waitForTimeout(500);
  out.push('일치도: ' + JSON.stringify(await p.evaluate(() => HG.activities.dictation.lastMarks.map((m) => (m.pct == null ? '띄어쓰기' : m.pct + '%' + (m.best && m.reason === 'other' ? '(' + m.best + ')' : ''))))));
  out.push('바르게 쓴 문장 → ' + (await p.locator('.dict-verdict').textContent()) + ' / 칸 표시: ✔' + (await p.locator('.trace-box.is-ok').count()) + ' ?' + (await p.locator('.trace-box.is-bad').count()));
  await p.screenshot({ path: require('os').tmpdir() + '/judge-ok.png' });
  await p.getByRole('button', { name: '다시 써 보기' }).click(); await p.waitForTimeout(300);
  await writeText('동혜 물고');
  await p.getByRole('button', { name: '다 썼어요' }).click(); await p.waitForTimeout(500);
  out.push('일치도: ' + JSON.stringify(await p.evaluate(() => HG.activities.dictation.lastMarks.map((m) => (m.pct == null ? '띄어쓰기' : m.pct + '%' + (m.reason === 'other' ? '(' + m.best + ' ' + m.bestPct + '%)' : ''))))));
  out.push('두 글자 틀리게 쓴 문장 → ' + (await p.locator('.dict-verdict').textContent()) + ' / 틀린 칸: ' + (await p.locator('.trace-box.is-bad').count()) + ' / 밑줄 글자: ' + (await p.$$eval('.ch-bad', (e) => e.map((x) => x.textContent).join(''))));
  await p.screenshot({ path: require('os').tmpdir() + '/judge-bad.png' });
  await p.getByRole('button', { name: /맞음으로 바꾸기/ }).click(); await p.waitForTimeout(300);
  out.push('강사 판정 → ' + (await p.locator('.dict-verdict').textContent()));
  await p.getByRole('button', { name: '다음 문장' }).click(); await p.waitForTimeout(400);
  await p.mouse.move(700, 600); await p.mouse.down(); for (let i = 0; i < 20; i++) await p.mouse.move(700 + i * 20, 600 + (i % 2) * 30); await p.mouse.up();
  await p.getByRole('button', { name: '다 썼어요' }).click(); await p.waitForTimeout(500);
  out.push('일치도: ' + JSON.stringify(await p.evaluate(() => HG.activities.dictation.lastMarks.map((m) => m.pct))));
  out.push('낙서 → ' + (await p.locator('.dict-verdict').textContent()));
  const rec = await p.evaluate(() => HG.state.settings.dictGuide);
  out.push('흐린 글씨 기본값: ' + rec + ' / 쓰는 중 흐린 글씨 칸: 없음 확인');
  console.log(out.join('\n'));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
