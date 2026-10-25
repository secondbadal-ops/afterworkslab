// 날짜 계산기 — 계산 로직 (확정 규칙: verify-payload-date-calc-1023.md, 수요 게이트: demand-check-date-calc-1023.md)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.
// 날짜는 UTC 정오 기준으로 다뤄 시간대·서머타임 영향을 받지 않는다.
// 공휴일: 2027년은 사이트 정본(holidays-2027/calc.js 확정 데이터셋)을 재사용,
// 2026년은 복수 출처 교차 확인분. 제헌절(2026-07-17)은 공휴일 재지정 여부가 출처마다 달라 자동 제외에서 뺐다.
(function () {
  'use strict';

  var DAY_MS = 86400000;
  var WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
  var COVER_START = '2026-01-01';
  var COVER_END = '2027-12-31';

  function parseDate(str) {
    if (!str || typeof str !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1900 || y > 2100) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }
  function fmtDate(dt) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return dt.getUTCFullYear() + '-' + p(dt.getUTCMonth() + 1) + '-' + p(dt.getUTCDate());
  }
  function weekdayKo(dt) { return WEEKDAYS_KO[dt.getUTCDay()]; }
  function fmtKo(str) {
    var dt = parseDate(str);
    if (!dt) return '';
    return dt.getUTCFullYear() + '년 ' + (dt.getUTCMonth() + 1) + '월 ' + dt.getUTCDate() + '일(' + weekdayKo(dt) + ')';
  }
  function addDays(dt, days) { return new Date(dt.getTime() + days * DAY_MS); }
  function diffDays(a, b) { return Math.round((b.getTime() - a.getTime()) / DAY_MS); }
  function isWeekend(dt) { var w = dt.getUTCDay(); return w === 0 || w === 6; }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, mo) { return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]; }
  function addMonthsClamped(dt, months) {
    var total = dt.getUTCFullYear() * 12 + dt.getUTCMonth() + months;
    var y = Math.floor(total / 12), mo = total - y * 12; // mo: 0-11
    var d = Math.min(dt.getUTCDate(), daysInMonth(y, mo + 1));
    return new Date(Date.UTC(y, mo, d, 12, 0, 0));
  }

  // ---------- 공휴일 이름 맵 (자동 제외 대상) ----------
  var HOLIDAY_NAMES = {
    // 2026 (복수 출처 교차 확인, 제헌절 제외)
    '2026-01-01': '신정',
    '2026-02-16': '설 연휴', '2026-02-17': '설날', '2026-02-18': '설 연휴',
    '2026-03-01': '삼일절', '2026-03-02': '대체공휴일(삼일절)',
    '2026-05-01': '근로자의 날', '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일(부처님오신날)',
    '2026-06-03': '지방선거일', '2026-06-06': '현충일',
    '2026-08-15': '광복절', '2026-08-17': '대체공휴일(광복절)',
    '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
    '2026-10-03': '개천절', '2026-10-05': '대체공휴일(개천절)',
    '2026-10-09': '한글날', '2026-12-25': '성탄절',
    // 2027 (사이트 정본 holidays-2027/calc.js 확정 데이터셋과 동일)
    '2027-01-01': '신정',
    '2027-02-06': '설 연휴', '2027-02-07': '설날', '2027-02-08': '설 연휴', '2027-02-09': '대체공휴일(설)',
    '2027-03-01': '삼일절',
    '2027-05-01': '근로자의 날', '2027-05-03': '대체공휴일(근로자의 날)',
    '2027-05-05': '어린이날', '2027-05-13': '부처님오신날',
    '2027-06-06': '현충일',
    '2027-07-17': '제헌절', '2027-07-19': '대체공휴일(제헌절)',
    '2027-08-15': '광복절', '2027-08-16': '대체공휴일(광복절)',
    '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴',
    '2027-10-03': '개천절', '2027-10-04': '대체공휴일(개천절)',
    '2027-10-09': '한글날', '2027-10-11': '대체공휴일(한글날)',
    '2027-12-25': '성탄절', '2027-12-27': '대체공휴일(성탄절)'
  };
  function holidayName(str) { return HOLIDAY_NAMES[str] || null; }
  function isCovered(str) { return str >= COVER_START && str <= COVER_END; }

  function extraSet(extra) {
    var s = {};
    (extra || []).forEach(function (d) { if (parseDate(d)) s[d] = true; });
    return s;
  }
  function isBusinessDay(dt, xset) {
    if (isWeekend(dt)) return false;
    var str = fmtDate(dt);
    if (HOLIDAY_NAMES[str]) return false;
    if (xset && xset[str]) return false;
    return true;
  }

  // ---------- 1. 날짜 차이 · 디데이 ----------
  // days = 종료 - 시작 (시작일 제외). reversed면 양수 days와 swapped=true를 돌려준다.
  function diffInfo(startStr, endStr, opts) {
    opts = opts || {};
    var a = parseDate(startStr), b = parseDate(endStr);
    if (!a || !b) return null;
    var swapped = false;
    if (diffDays(a, b) < 0) { var t = a; a = b; b = t; swapped = true; }
    var days = diffDays(a, b);
    var inclDays = days + 1;
    // 년·개월·일 분해: 시작일에 개월을 먼저 더하고(월말 클램프) 남은 일수를 센다
    var months = 0;
    while (diffDays(addMonthsClamped(a, months + 1), b) >= 0) months++;
    var rem = diffDays(addMonthsClamped(a, months), b);
    var ymd = { years: Math.floor(months / 12), months: months % 12, days: rem };
    // 평일·영업일·제외 공휴일 (양끝 포함)
    var weekdays = 0, business = 0, excluded = [];
    var cur = a;
    var guard = 0;
    while (diffDays(cur, b) >= 0 && guard < 40000) {
      guard++;
      if (!isWeekend(cur)) {
        weekdays++;
        var str = fmtDate(cur);
        var hn = HOLIDAY_NAMES[str];
        if (hn) excluded.push({ date: str, name: hn });
        else business++;
      }
      cur = addDays(cur, 1);
    }
    return {
      days: days, inclDays: inclDays, swapped: swapped,
      weeks: Math.floor(days / 7), weekRem: days % 7,
      ymd: ymd, weekdays: weekdays, businessDays: business,
      excludedHolidays: excluded,
      partialCoverage: !(isCovered(fmtDate(a)) && isCovered(fmtDate(b)))
    };
  }
  // 디데이 표기: base(기준일)에서 target까지. 남은 날수 = diffDays(base, target)
  function ddayLabel(baseStr, targetStr) {
    var a = parseDate(baseStr), b = parseDate(targetStr);
    if (!a || !b) return null;
    var d = diffDays(a, b);
    if (d === 0) return 'D-DAY';
    return d > 0 ? 'D-' + d : 'D+' + (-d);
  }

  // ---------- 2. N일 후·전 ----------
  // unit: 'day' | 'week' | 'month' | 'year'. firstDayCounts는 일·주에서만 적용 (N일째 = 기준일 + (N-1)일).
  function addPeriod(baseStr, n, unit, dir, firstDayCounts) {
    var base = parseDate(baseStr);
    if (!base) return null;
    if (typeof n !== 'number' || !isFinite(n) || Math.floor(n) !== n || n < 0 || n > 36500) return null;
    var sign = dir === 'before' ? -1 : 1;
    if (unit === 'day' || unit === 'week') {
      var steps = n * (unit === 'week' ? 7 : 1);
      if (firstDayCounts && sign > 0 && n >= 1) steps -= 1;
      return fmtDate(addDays(base, sign * steps));
    }
    if (unit === 'month') return fmtDate(addMonthsClamped(base, sign * n));
    if (unit === 'year') return fmtDate(addMonthsClamped(base, sign * n * 12));
    return null;
  }

  // ---------- 3. 영업일 ----------
  // WORKDAY 방식: 시작일 당일은 세지 않는다. n=0이면 시작일 그대로.
  function addBusinessDays(startStr, n, dir, extra) {
    var cur = parseDate(startStr);
    if (!cur) return null;
    if (typeof n !== 'number' || !isFinite(n) || Math.floor(n) !== n || n < 0 || n > 3650) return null;
    var xset = extraSet(extra);
    var sign = dir === 'before' ? -1 : 1;
    var left = n, guard = 0;
    while (left > 0 && guard < 200000) {
      guard++;
      cur = addDays(cur, sign);
      if (isBusinessDay(cur, xset)) left--;
    }
    if (left > 0) return null;
    return fmtDate(cur);
  }

  // ---------- 4. 만 나이 ----------
  var ZODIAC = ['원숭이', '닭', '개', '돼지', '쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양'];
  // 2월 29일생은 평년에 3월 1일을 생일로 본다
  function birthdayInYear(birth, year) {
    var mo = birth.getUTCMonth() + 1, d = birth.getUTCDate();
    if (mo === 2 && d === 29 && !isLeap(year)) return new Date(Date.UTC(year, 2, 1, 12, 0, 0));
    return new Date(Date.UTC(year, mo - 1, d, 12, 0, 0));
  }
  function ageInfo(birthStr, baseStr) {
    var birth = parseDate(birthStr), base = parseDate(baseStr);
    if (!birth || !base) return null;
    if (diffDays(birth, base) < 0) return { error: 'future' };
    var by = base.getUTCFullYear(), birthYear = birth.getUTCFullYear();
    var bdayThisYear = birthdayInYear(birth, by);
    var sinceBday = diffDays(bdayThisYear, base);
    var passed = sinceBday >= 0;
    var man = by - birthYear - (passed ? 0 : 1);
    // 생일 당일은 다음 생일까지 0일 (오늘 생일)
    var next = sinceBday === 0 ? bdayThisYear : (passed ? birthdayInYear(birth, by + 1) : bdayThisYear);
    return {
      man: man,
      yeon: by - birthYear,
      counting: by - birthYear + 1,
      birthdayPassed: passed,
      thisYearBirthday: fmtDate(bdayThisYear),
      nextBirthday: fmtDate(next),
      nextBirthdayDays: diffDays(base, next),
      livedDays: diffDays(birth, base) + 1,
      zodiac: ZODIAC[birthYear % 12]
    };
  }

  // ---------- 5. 기념일 표 ----------
  // N일째 = 시작일 + (N-1)일. N주년 = 시작일에 N년을 더함(월말 클램프).
  function milestones(startStr, todayStr) {
    var start = parseDate(startStr), today = parseDate(todayStr);
    if (!start || !today) return null;
    var out = [];
    function push(label, dateStr) {
      var dt = parseDate(dateStr);
      var rel = diffDays(today, dt);
      out.push({
        label: label, date: dateStr, weekday: weekdayKo(dt),
        relDays: rel,
        relLabel: rel === 0 ? '오늘' : (rel > 0 ? rel + '일 남음' : (-rel) + '일 지남')
      });
    }
    [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].forEach(function (n) {
      push(n + '일째', fmtDate(addDays(start, n - 1)));
    });
    [1, 2, 3, 5, 10].forEach(function (y) {
      push(y + '주년', fmtDate(addMonthsClamped(start, y * 12)));
    });
    return out;
  }

  var api = {
    DAY_MS: DAY_MS, COVER_START: COVER_START, COVER_END: COVER_END,
    HOLIDAY_NAMES: HOLIDAY_NAMES,
    parseDate: parseDate, fmtDate: fmtDate, fmtKo: fmtKo, addDays: addDays,
    diffDays: diffDays, isWeekend: isWeekend, weekdayKo: weekdayKo,
    holidayName: holidayName, isCovered: isCovered, isBusinessDay: isBusinessDay,
    diffInfo: diffInfo, ddayLabel: ddayLabel, addPeriod: addPeriod,
    addBusinessDays: addBusinessDays, ageInfo: ageInfo, milestones: milestones
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.DateCalc = api;
})();
