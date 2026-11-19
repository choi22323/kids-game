/* 가상 데이터 백업 픽스처 생성기 (개발용). 사용: node tests/fixtures/make-fixtures.js
   실제 이용자 정보는 넣지 않는다. 결과: tests/fixtures/fixtures.js */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sum = (d) => crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex');
const T = '2026-11-01T01:00:00.000Z';
const set = {
  id: 'fx-set-1', title: '가상 세트', topicId: 'topic-family', level: 'beginner', description: '', isBuiltIn: false, isHidden: false,
  words: ['나무', '바다', '하늘', '우유'].map((t, i) => ({ id: 'w' + (i + 1), text: t, image: null, hint: '', order: i })),
  sentences: [{ id: 's1', text: '하늘이 파래요.', answer: '하늘', distractors: ['허리', '나무'], order: 0 }],
  activityOptions: { trace: { enabled: true, gridStyle: 'cross', repeat: 1 }, chosung: { enabled: true, optionCount: 3, showImageHint: true }, match: { enabled: true, pairsPerRound: 3 }, blank: { enabled: true } },
  tags: [], sourceSetId: null, createdAt: T, updatedAt: T
};
const data = { topics: [], builtInTopics: [], problemSets: [set], builtInState: [], assets: [], lessons: [], activityRecords: [], settings: [{ key: 'fontScale', value: 1.15 }] };
const wrap = (o, d) => Object.assign({ format: 'hangul-classroom-backup', schemaVersion: 1, appVersion: '1.0.0', exportedAt: T }, o, { checksum: { algorithm: 'SHA-256', value: sum(d) }, data: d });
const valid = wrap({}, data);
const tampered = JSON.parse(JSON.stringify(valid)); tampered.data.problemSets[0].title = '바뀐 제목';
const future = wrap({ schemaVersion: 99 }, data);
const other = { format: 'something-else', data: {} };
const badRecord = (() => { const d = JSON.parse(JSON.stringify(data)); d.problemSets[0].sentences[0].answer = '없는말'; return wrap({}, d); })();
const v0data = { topics: [], sets: [set], assets: [], lessons: [], activityRecords: [], settings: [] };
const v0 = wrap({ schemaVersion: 0 }, v0data);
const validText = JSON.stringify(valid);
const proto = validText.replace('"data":{', '"data":{"__proto__":{"polluted":true},');
const out = {
  valid: validText, tampered: JSON.stringify(tampered), future: JSON.stringify(future), other: JSON.stringify(other),
  notJson: '이것은 JSON이 아닙니다', badRecord: JSON.stringify(badRecord), v0: JSON.stringify(v0), proto
};
fs.writeFileSync(path.join(__dirname, 'fixtures.js'), '/* 자동 생성: make-fixtures.js — 가상 데이터 */\nwindow.FIXTURES = ' + JSON.stringify(out, null, 1) + ';\n');
console.log('fixtures.js 생성');
