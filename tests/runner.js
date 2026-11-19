/* 최소 테스트 러너 (오프라인, 외부 라이브러리 없음) */
(function () {
  'use strict';
  const tests = [];
  let group = '';
  window.describe = (name, fn) => { group = name; fn(); group = ''; };
  window.it = (name, fn) => tests.push({ name: (group ? group + ' › ' : '') + name, fn });
  const show = (v) => { try { return JSON.stringify(v); } catch (e) { return String(v); } };
  window.assert = {
    eq(actual, expected, msg) { if (show(actual) !== show(expected)) throw new Error((msg ? msg + ': ' : '') + '기대 ' + show(expected) + ', 실제 ' + show(actual)); },
    ok(v, msg) { if (!v) throw new Error(msg || '참이어야 합니다'); },
    near(a, b, eps, msg) { if (Math.abs(a - b) > (eps || 1e-6)) throw new Error((msg || '') + ' 기대 ' + b + ' ± ' + eps + ', 실제 ' + a); }
  };
  window.runTests = async function () {
    const out = document.getElementById('out');
    const res = { pass: 0, fail: 0, failures: [] };
    for (const t of tests) {
      const li = document.createElement('li');
      try { await t.fn(); res.pass++; li.className = 'pass'; li.textContent = '✔ ' + t.name; }
      catch (e) { res.fail++; res.failures.push(t.name + ' — ' + e.message); li.className = 'fail'; li.textContent = '✘ ' + t.name + ' — ' + e.message; }
      out.appendChild(li);
    }
    document.getElementById('summary').textContent = '통과 ' + res.pass + ' / 실패 ' + res.fail;
    window.__results = res;
    return res;
  };
})();
