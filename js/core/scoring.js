/* 점수·별 자동 계산 (FEATURES.md F-10) */
(function () {
  'use strict';
  const POINTS = { first: 10, retry: 7, revealed: 3, wrong: 3, skipped: 0 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function traceLetterScore(coverage, outside) {
    return clamp(Math.round((coverage || 0) * 100 - (outside || 0) * 50), 0, 100);
  }
  function activityScore(items, activity) {
    if (!items || !items.length) return 0;
    if (activity === 'trace') {
      const done = items.filter((r) => r.result !== 'skipped');
      if (!done.length) return 0;
      const s = done.reduce((a, r) => a + traceLetterScore(r.coverage, r.outside), 0) / done.length;
      return isFinite(s) ? Math.round(s) : 0;
    }
    const sum = items.reduce((a, r) => a + (POINTS[r.result] || 0), 0);
    const v = Math.round((sum / (10 * items.length)) * 100);
    return isFinite(v) ? v : 0;
  }
  /** 따라쓰기는 70/40, 나머지는 80/50 기준. 1문항 이상 참여하면 최소 1개 */
  function stars(score, participated, activity) {
    if (!participated) return 0;
    const [hi, mid] = activity === 'trace' ? [70, 40] : [80, 50];
    return score >= hi ? 3 : score >= mid ? 2 : 1;
  }
  function buildRecord(o) {
    const items = o.items || [];
    const c = { first: 0, retry: 0, revealed: 0, wrong: 0, skipped: 0 };
    items.forEach((r) => { c[r.result] = (c[r.result] || 0) + 1; });
    const participated = items.length - c.skipped > 0;
    const score = activityScore(items, o.activity);
    const covs = items.filter((r) => r.result !== 'skipped' && typeof r.coverage === 'number').map((r) => r.coverage);
    const ended = o.endedAt || HG.format.nowISO();
    return {
      id: HG.ids.uuid(),
      lessonId: o.lessonId || null,
      problemSetId: o.set.id,
      problemSetTitle: o.set.title,
      topicId: o.set.topicId,
      level: o.set.level,
      activity: o.activity,
      startedAt: o.startedAt,
      endedAt: ended,
      durationSec: Math.max(0, Math.round((new Date(ended) - new Date(o.startedAt)) / 1000)),
      totalQuestions: items.length,
      correctFirstTry: c.first,
      correctAfterRetry: c.retry,
      revealed: c.revealed,
      wrong: c.wrong,
      skipped: c.skipped,
      hintsUsed: o.hintsUsed || 0,
      avgCoverage: o.activity === 'trace' && covs.length ? Math.round((covs.reduce((a, b) => a + b, 0) / covs.length) * 1000) / 1000 : null,
      score,
      stars: stars(score, participated, o.activity),
      completed: o.completed !== false && participated,
      itemResults: items.map((r) => {
        const x = { itemId: r.itemId, text: r.text, attempts: r.attempts || 0, result: r.result };
        if (typeof r.coverage === 'number') x.coverage = Math.round(r.coverage * 1000) / 1000;
        return x;
      })
    };
  }
  function accuracy(rec) {
    const n = rec.totalQuestions - rec.skipped;
    return n > 0 ? (rec.correctFirstTry + rec.correctAfterRetry) / n : 0;
  }
  HG.scoring = { POINTS, traceLetterScore, activityScore, stars, buildRecord, accuracy };
})();
