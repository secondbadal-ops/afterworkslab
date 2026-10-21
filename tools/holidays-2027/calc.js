// 공휴일 + 황금연휴 파인더 — 데이터와 계산 로직
// 2027 데이터 정본: holidays-2027-dataset-verified-1021.md (우주항공청 2027년 월력요항, 2026-06-29 발표)
// 2028 데이터: 예정 — holidays-2028-dataset-planned-1021.md (음력·대체 규칙 계산, 복수 출처 교차 확인 2026-10-21)
// 순수 데이터·함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.

// ---------- 날짜 유틸 (UTC 정오 기준) ----------
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3];
  var dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
function fmtDate(dt) {
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return dt.getUTCFullYear() + '-' + p(dt.getUTCMonth() + 1) + '-' + p(dt.getUTCDate());
}
function addDays(dt, days) { return new Date(dt.getTime() + days * 86400000); }
function diffDays(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function isWeekend(dt) { var w = dt.getUTCDay(); return w === 0 || w === 6; }
var WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
function weekdayKo(dt) { return WEEKDAYS_KO[dt.getUTCDay()]; }
function shortDate(str) {
  var dt = parseDate(str);
  return (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate() + '(' + weekdayKo(dt) + ')';
}

// ---------- 2027 확정 데이터 (정본 표 13행) ----------
// dates: 지정 공휴일 날짜들. substitute: 대체공휴일 날짜 또는 null.
// breakStart/breakEnd: 주말을 포함한 실제 쉬는 구간.
var HOLIDAYS = [
  { name: '신정', dates: ['2027-01-01'], substitute: null, substituteNote: '대상 아님', breakStart: '2027-01-01', breakEnd: '2027-01-03', breakLabel: '1/1~1/3, 3일' },
  { name: '설 연휴', dates: ['2027-02-06', '2027-02-07', '2027-02-08'], substitute: '2027-02-09', substituteNote: '2/9(화)', breakStart: '2027-02-06', breakEnd: '2027-02-09', breakLabel: '2/6~2/9, 4일' },
  { name: '삼일절', dates: ['2027-03-01'], substitute: null, substituteNote: '해당 없음', breakStart: '2027-02-27', breakEnd: '2027-03-01', breakLabel: '2/27~3/1, 3일' },
  { name: '노동절', dates: ['2027-05-01'], substitute: '2027-05-03', substituteNote: '5/3(월)', breakStart: '2027-05-01', breakEnd: '2027-05-03', breakLabel: '5/1~5/3, 3일' },
  { name: '어린이날', dates: ['2027-05-05'], substitute: null, substituteNote: '해당 없음', breakStart: '2027-05-05', breakEnd: '2027-05-05', breakLabel: '당일' },
  { name: '부처님오신날', dates: ['2027-05-13'], substitute: null, substituteNote: '해당 없음', breakStart: '2027-05-13', breakEnd: '2027-05-13', breakLabel: '당일' },
  { name: '현충일', dates: ['2027-06-06'], substitute: null, substituteNote: '대상 아님', breakStart: '2027-06-06', breakEnd: '2027-06-06', breakLabel: '평일 휴일 0' },
  { name: '제헌절', dates: ['2027-07-17'], substitute: '2027-07-19', substituteNote: '7/19(월)', breakStart: '2027-07-17', breakEnd: '2027-07-19', breakLabel: '7/17~7/19, 3일' },
  { name: '광복절', dates: ['2027-08-15'], substitute: '2027-08-16', substituteNote: '8/16(월)', breakStart: '2027-08-14', breakEnd: '2027-08-16', breakLabel: '8/14~8/16, 3일' },
  { name: '추석 연휴', dates: ['2027-09-14', '2027-09-15', '2027-09-16'], substitute: null, substituteNote: '해당 없음', breakStart: '2027-09-14', breakEnd: '2027-09-16', breakLabel: '3일 (주말과 안 붙음)' },
  { name: '개천절', dates: ['2027-10-03'], substitute: '2027-10-04', substituteNote: '10/4(월)', breakStart: '2027-10-02', breakEnd: '2027-10-04', breakLabel: '10/2~10/4, 3일' },
  { name: '한글날', dates: ['2027-10-09'], substitute: '2027-10-11', substituteNote: '10/11(월)', breakStart: '2027-10-09', breakEnd: '2027-10-11', breakLabel: '10/9~10/11, 3일' },
  { name: '성탄절', dates: ['2027-12-25'], substitute: '2027-12-27', substituteNote: '12/27(월)', breakStart: '2027-12-25', breakEnd: '2027-12-27', breakLabel: '12/25~12/27, 3일' }
];

// 합계 (정본 검증 완료): 지정 17 + 대체 7 = 24, 관공서 72, 주5일 실질 119, 3일 이상 연휴 10차례
var SUMMARY = { designated: 17, substitutes: 7, publicTotal: 24, officialTotal: 72, actualTotal: 119, longBreaks: 10 };

// ---------- 2028 예정 데이터 (같은 구조, holidays-2028-dataset-planned-1021.md) ----------
// 개천절(10/3)이 추석 당일과 같아 추석 행에 통합 표기했다. 대체공휴일은 10/5 하나뿐이다.
var HOLIDAYS_2028 = [
  { name: '신정', dates: ['2028-01-01'], substitute: null, substituteNote: '대상 아님', breakStart: '2028-01-01', breakEnd: '2028-01-02', breakLabel: '1/1~1/2 (주말)' },
  { name: '설 연휴', dates: ['2028-01-25', '2028-01-26', '2028-01-27'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-01-25', breakEnd: '2028-01-27', breakLabel: '1/25~1/27, 3일' },
  { name: '삼일절', dates: ['2028-03-01'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-03-01', breakEnd: '2028-03-01', breakLabel: '당일' },
  { name: '노동절', dates: ['2028-05-01'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-04-29', breakEnd: '2028-05-01', breakLabel: '4/29~5/1, 3일' },
  { name: '부처님오신날', dates: ['2028-05-02'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-05-02', breakEnd: '2028-05-02', breakLabel: '당일 (노동절과 이어짐)' },
  { name: '어린이날', dates: ['2028-05-05'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-05-05', breakEnd: '2028-05-07', breakLabel: '5/5~5/7, 3일' },
  { name: '현충일', dates: ['2028-06-06'], substitute: null, substituteNote: '대상 아님', breakStart: '2028-06-06', breakEnd: '2028-06-06', breakLabel: '당일' },
  { name: '제헌절', dates: ['2028-07-17'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-07-15', breakEnd: '2028-07-17', breakLabel: '7/15~7/17, 3일' },
  { name: '광복절', dates: ['2028-08-15'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-08-15', breakEnd: '2028-08-15', breakLabel: '당일' },
  { name: '추석 연휴·개천절', dates: ['2028-10-02', '2028-10-03', '2028-10-04'], substitute: '2028-10-05', substituteNote: '10/5(목) — 개천절 겹침', breakStart: '2028-09-30', breakEnd: '2028-10-05', breakLabel: '9/30~10/5, 6일' },
  { name: '한글날', dates: ['2028-10-09'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-10-07', breakEnd: '2028-10-09', breakLabel: '10/7~10/9, 3일' },
  { name: '성탄절', dates: ['2028-12-25'], substitute: null, substituteNote: '해당 없음', breakStart: '2028-12-23', breakEnd: '2028-12-25', breakLabel: '12/23~12/25, 3일' }
];

var YEAR_DATA = {
  '2027': { status: 'confirmed', label: '확정', entries: HOLIDAYS },
  '2028': { status: 'planned', label: '예정', entries: HOLIDAYS_2028 }
};
function yearEntries(year) {
  var yd = YEAR_DATA[String(year)];
  return yd ? yd.entries : null;
}

// ---------- 이름 맵 (달력 라벨용) ----------
function buildNameMap(entries) {
  var map = {};
  entries.forEach(function (e) {
    e.dates.forEach(function (d, i) {
      var label = e.name;
      if (e.name === '설 연휴') label = (i === 1 ? '설날' : '설 연휴');
      if (e.name === '추석 연휴') label = (i === 1 ? '추석' : '추석 연휴');
      if (e.name === '추석 연휴·개천절') label = (i === 1 ? '추석·개천절' : '추석 연휴');
      map[d] = label;
    });
    if (e.substitute) map[e.substitute] = '대체공휴일';
  });
  return map;
}
function holidayNameMap(year) {
  var entries = yearEntries(year);
  return entries ? buildNameMap(entries) : {};
}
function allHolidayDates() {
  var out = [];
  HOLIDAYS.forEach(function (h) {
    h.dates.forEach(function (d) { out.push(d); });
    if (h.substitute) out.push(h.substitute);
  });
  return out;
}
function holidaySet() {
  var s = {};
  allHolidayDates().forEach(function (d) { s[d] = true; });
  return s;
}
function isWorkingDay(str, set) {
  var dt = parseDate(str);
  return !!dt && !isWeekend(dt) && !set[str];
}

// ---------- 황금연휴 탐색 ----------
// 대상 연도의 공휴일·주말에 연차를 붙여 만들 수 있는 연속 휴무 구간을 전부 찾는다.
// 연차는 대상 연도 안의 근무일에만 쓸 수 있다. 구간의 끝은 쉬는 날이어야 하고,
// 공휴일이 최소 하루는 포함돼야 한다 (주말만 이은 구간은 제외).
function buildScanDays(year) {
  var map = holidayNameMap(year);
  // 경계: 전년도 성탄절(양력 고정)과 다음 해 신정(양력 고정)은 연도 경계 구간 판정에만 쓴다.
  var prevXmas = (year - 1) + '-12-25';
  if (!map[prevXmas]) {
    map[prevXmas] = '성탄절';
    var w = parseDate(prevXmas).getUTCDay();
    if (w === 6) map[(year - 1) + '-12-27'] = '대체공휴일';
    if (w === 0) map[(year - 1) + '-12-26'] = '대체공휴일';
  }
  var nextNewYear = (year + 1) + '-01-01';
  if (!map[nextNewYear]) map[nextNewYear] = '신정';
  var start = parseDate((year - 1) + '-12-24');
  var end = parseDate((year + 1) + '-01-08');
  var days = [];
  for (var d = start; diffDays(d, end) >= 0; d = addDays(d, 1)) {
    var str = fmtDate(d);
    var hol = map[str] || null;
    days.push({
      str: str, dt: d, weekend: isWeekend(d), holiday: hol,
      inYear: d.getUTCFullYear() === year,
      working: !isWeekend(d) && !hol
    });
  }
  return days;
}
function findCombos(year, maxLeave) {
  var y = Number(year);
  var cap = Number(maxLeave);
  if (!yearEntries(y) || !isFinite(cap) || cap < 0) return { status: 'error', message: '연도와 연차 일수를 확인해 주세요.' };
  cap = Math.min(Math.floor(cap), 30);
  var days = buildScanDays(y);
  var n = days.length;
  // prefix sums: workIn(연도 안 근무일), workOut(연도 밖 근무일), hol(연도 안 공휴일)
  var pw = [0], po = [0], ph = [0];
  for (var i = 0; i < n; i++) {
    pw.push(pw[i] + (days[i].working && days[i].inYear ? 1 : 0));
    po.push(po[i] + (days[i].working && !days[i].inYear ? 1 : 0));
    ph.push(ph[i] + (days[i].holiday && days[i].inYear ? 1 : 0));
  }
  function rangeSum(p, a, b) { return p[b + 1] - p[a]; }
  var byKey = {};
  var list = [];
  for (var a = 0; a < n; a++) {
    if (days[a].working && !days[a].inYear) continue;
    var maxB = Math.min(n - 1, a + 44);
    for (var b = a; b <= maxB; b++) {
      if (rangeSum(po, a, b) > 0) break; // 연도 밖 근무일이 끼면 그 이상 확장 불가
      var leave = rangeSum(pw, a, b);
      if (leave > cap) break;
      var total = b - a + 1;
      if (total < 3) continue;
      if (days[b].working) continue; // 끝은 쉬는 날
      if (rangeSum(ph, a, b) < 1) continue; // 공휴일 최소 1일
      var key = days[a].str + '|' + days[b].str;
      if (byKey[key]) continue;
      byKey[key] = true;
      list.push({ a: a, b: b, leave: leave, total: total });
    }
  }
  // 지배 제거: 다른 구간에 완전히 포함되면서 연차를 더 쓰거나 같은 구간은 버린다
  list.sort(function (x, z) { return x.a - z.a || z.b - x.b || x.leave - z.leave; });
  var kept = [];
  list.forEach(function (c) {
    var dominated = kept.some(function (k) {
      return k.a <= c.a && k.b >= c.b && k.leave <= c.leave && (k.a < c.a || k.b > c.b || k.leave < c.leave);
    });
    if (!dominated) kept.push(c);
  });
  // 구간 객체로 변환
  var combos = kept.map(function (c) {
    var leaveDates = [], names = [], seenName = {};
    for (var i = c.a; i <= c.b; i++) {
      if (days[i].working) leaveDates.push(days[i].str);
      if (days[i].holiday && !seenName[days[i].holiday]) { seenName[days[i].holiday] = true; names.push(days[i].holiday); }
    }
    var startDt = days[c.a].dt;
    return {
      start: days[c.a].str, end: days[c.b].str,
      totalDays: c.total, leaveDays: c.leave, leaveDates: leaveDates,
      names: names, month: startDt.getUTCMonth() + 1,
      efficiency: c.leave > 0 ? Math.round((c.total / c.leave) * 100) / 100 : null,
      key: days[c.a].str + '|' + days[c.b].str
    };
  });
  var byLongest = combos.slice().sort(function (x, z) {
    return z.totalDays - x.totalDays || x.leaveDays - z.leaveDays || (x.start < z.start ? -1 : 1);
  });
  function overlaps(c, o) { return c && o && c.start <= o.end && o.start <= c.end; }
  var hero = byLongest.length ? byLongest[0] : null;
  // 절약형: hero와 겹치지 않는 후보 중 효율(총 일수 ÷ 연차) 1위 — 같은 명절의 부분 구간이 나란히 뜨지 않게 한다
  var saver = null;
  combos.forEach(function (c) {
    if (c.leaveDays < 1) return;
    if (overlaps(c, hero)) return;
    if (!saver || c.efficiency > saver.efficiency ||
      (c.efficiency === saver.efficiency && (c.totalDays > saver.totalDays || (c.totalDays === saver.totalDays && c.start < saver.start)))) {
      saver = c;
    }
  });
  var usedMonth = {}, usedKey = {}, chosen = [];
  if (hero) { usedMonth[hero.month] = true; usedKey[hero.key] = true; chosen.push(hero); }
  if (saver) { usedMonth[saver.month] = true; usedKey[saver.key] = true; chosen.push(saver); }
  function hitsChosen(c) { return chosen.some(function (o) { return overlaps(c, o); }); }
  var alts = [];
  byLongest.forEach(function (c) {
    if (alts.length >= 3 || usedKey[c.key] || hitsChosen(c)) return;
    if (usedMonth[c.month]) return;
    usedMonth[c.month] = true; usedKey[c.key] = true; chosen.push(c);
    alts.push(c);
  });
  if (alts.length < 3) {
    byLongest.forEach(function (c) {
      if (alts.length >= 3 || usedKey[c.key] || hitsChosen(c)) return;
      usedKey[c.key] = true; chosen.push(c);
      alts.push(c);
    });
  }
  return { status: 'ok', year: y, maxLeave: cap, hero: hero, saver: saver, alts: alts, count: combos.length, combos: combos };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HOLIDAYS: HOLIDAYS, HOLIDAYS_2028: HOLIDAYS_2028, SUMMARY: SUMMARY, YEAR_DATA: YEAR_DATA,
    parseDate: parseDate, fmtDate: fmtDate, addDays: addDays, diffDays: diffDays,
    isWeekend: isWeekend, weekdayKo: weekdayKo, shortDate: shortDate,
    allHolidayDates: allHolidayDates, holidaySet: holidaySet, isWorkingDay: isWorkingDay,
    buildNameMap: buildNameMap, holidayNameMap: holidayNameMap, yearEntries: yearEntries,
    buildScanDays: buildScanDays, findCombos: findCombos
  };
}
