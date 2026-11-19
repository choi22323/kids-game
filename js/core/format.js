/* 날짜·숫자 표시와 공통 라벨 */
(function () {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowISO() { return new Date().toISOString(); }
  function isValidYmd(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }
  function ymdToDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function dateLabel(ymd) {
    if (!isValidYmd(ymd)) return '';
    const d = ymdToDate(ymd);
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WEEK[d.getDay()] + ')';
  }
  function dateTimeLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function stamp(d) {
    d = d || new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes());
  }
  function daysSince(iso) {
    if (!iso) return Infinity;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  }
  /** 기준 시각에서 months 개월 전 ISO */
  function monthsAgoISO(months, from) {
    const d = from ? new Date(from) : new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString();
  }
  function percent(v) { return (isFinite(v) ? Math.round(v * 100) : 0) + '%'; }

  HG.format = { pad, todayStr, nowISO, isValidYmd, ymdToDate, dateLabel, dateTimeLabel, stamp, daysSince, monthsAgoISO, percent };

  HG.labels = {
    levels: ['beginner', 'intermediate', 'advanced'],
    level: { beginner: '초급', intermediate: '중급', advanced: '고급' },
    activities: ['trace', 'chosung', 'match', 'blank'],
    activity: { trace: '깍두기 칸 따라쓰기', chosung: '초성 보고 낱말 맞히기', match: '그림과 낱말 짝짓기', blank: '빈칸 문장 완성하기' },
    activityShort: { trace: '따라쓰기', chosung: '초성 맞히기', match: '짝짓기', blank: '빈칸 문장' },
    activityIcon: { trace: '✍️', chosung: '🔤', match: '🔗', blank: '📝' },
    status: { planned: '예정', inProgress: '진행 중', done: '마침', canceled: '취소' },
    topicIcons: ['family', 'health', 'market', 'seasons', 'transport', 'book', 'star', 'home', 'food', 'holiday'],
    topicIcon: { family: '👪', health: '🏥', market: '🛒', seasons: '🌸', transport: '🚌', book: '📖', star: '⭐', home: '🏠', food: '🍚', holiday: '🎎' }
  };
})();
