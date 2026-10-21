// 연차 계산기 (퇴직 정산 특화) — 계산 로직
// 확정 규칙: calc-rules-annual-leave-final-1021.md (2026-10-21) + annual-leave-open-items-1021.md 조사 반영
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.

// ---------- 날짜 유틸 (UTC 정오 기준, 시간대 영향 제거) ----------
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  var dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
function fmtDate(dt) {
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return dt.getUTCFullYear() + '-' + p(dt.getUTCMonth() + 1) + '-' + p(dt.getUTCDate());
}
function addMonths(dt, months) {
  var y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + months, d = dt.getUTCDate();
  var ny = y + Math.floor(mo / 12), nmo = ((mo % 12) + 12) % 12;
  var lastDay = new Date(Date.UTC(ny, nmo + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ny, nmo, Math.min(d, lastDay), 12, 0, 0));
}
function addYears(dt, years) { return addMonths(dt, years * 12); }
function addDays(dt, days) { return new Date(dt.getTime() + days * 86400000); }
function cmpDate(a, b) { return a.getTime() - b.getTime(); }

// ---------- 상수 ----------
// 구규정(종전 제60조 제3항) 안내 트리거: 입사일이 2017-05-29 이전(당일 포함)이면 본 계산 대상에서 제외
// (annual-leave-open-items-1021.md 조사 1번 확정 — 고용노동부 설명자료 기준)
var OLD_RULE_CUTOFF = '2017-05-29';

// 연 단위 발생 일수표 (근로기준법 제60조 제1항·제4항): 완성연수 k년 -> 15 + floor((k-1)/2), 상한 25
function annualDaysForYear(k) {
  if (k < 1) return 0;
  var d = 15 + Math.floor((k - 1) / 2);
  return d > 25 ? 25 : d;
}

// 월 통상임금 산정 기준시간 수.
// 주 40시간이면 실무 기준 209시간. 그 외에는 (주 소정근로시간 + 주휴시간) x 365 / 7 / 12 를 반올림한다.
// 주휴시간은 주 15시간 이상일 때 주 소정근로시간 / 40 x 8 (상한 8시간).
function monthlyStandardHours(weeklyHours) {
  if (weeklyHours === 40) return 209;
  var holiday = weeklyHours >= 15 ? Math.min(8, weeklyHours / 40 * 8) : 0;
  return Math.round((weeklyHours + holiday) * 365 / 7 / 12);
}

// ---------- 발생 이벤트 생성 ----------
// input: {hire: Date, end: Date, lowAttendanceYears: [{yearIndex, fullMonths}]}
// lowAttendanceYears: 출근율 80% 미만인 근로연도(완성연수 k)의 제2항 fallback 개근 개월 수
// 반환: [{type:'monthly'|'annual', accrualDate, expiryDate, days, period}]
function buildEvents(input) {
  var hire = input.hire, end = input.end;
  var fallback = {};
  (input.lowAttendanceYears || []).forEach(function (r) { fallback[r.yearIndex] = r.fullMonths; });
  var events = [];
  var firstYearEnd = addDays(addYears(hire, 1), -1); // 최초 1년의 근로가 끝나는 날

  // 제2항 월 단위: 매 1개월 개근을 마친 다음 날(=입사 + m개월) 1일, 최대 11회
  for (var m = 1; m <= 11; m++) {
    var acc = addMonths(hire, m);
    if (cmpDate(acc, end) <= 0) {
      events.push({ type: 'monthly', accrualDate: acc, expiryDate: firstYearEnd, days: 1, period: '1년차 ' + m + '개월 개근' });
    }
  }
  // 제1항+제4항 연 단위: 근로연도 k년을 마친 다음 날(=입사 + k년)
  for (var k = 1; ; k++) {
    var aAcc = addYears(hire, k);
    if (cmpDate(aAcc, end) > 0) break;
    var days, note;
    if (fallback[k] !== undefined) {
      days = fallback[k];
      note = k + '년차 (출근율 80% 미만 — 개근 개월 수 기준)';
    } else {
      days = annualDaysForYear(k);
      note = k + '년차';
    }
    events.push({ type: 'annual', accrualDate: aAcc, expiryDate: addDays(addYears(aAcc, 1), -1), days: days, period: note });
  }
  events.sort(function (a, b) { return cmpDate(a.accrualDate, b.accrualDate); });
  return events;
}

// ---------- 본 계산 ----------
// input: {
//   mode: 'retire'|'current', hireStr, endStr, usedDays, monthlyWage(0이면 미입력),
//   weeklyHours, dailyHours, workers5plus: 'yes'|'no'|'unknown', hours15plus: 'yes'|'no'|'unknown',
//   promotion: 'yes'|'no', prepaidAllowance, lowAttendanceYears: [{yearIndex, fullMonths}],
//   hasSuspensionPeriod: boolean, dayDisplayPolicy: 1|2|3|4
// }
function calculate(input) {
  var hire = parseDate(input.hireStr);
  var end = parseDate(input.endStr);
  if (!hire || !end) return { status: 'error', message: '날짜를 정확히 입력해 주세요.' };
  if (cmpDate(end, hire) < 0) return { status: 'error', message: '마지막 근무일(기준일)이 입사일보다 빠릅니다.' };

  // 안전장치 1·2: 적용 제외 사업장·근로자
  if (input.workers5plus === 'no') {
    return { status: 'blocked', code: 'under5', message: '상시근로자 5인 미만 사업장에는 근로기준법 제60조(연차 유급휴가)가 적용되지 않아, 이 도구로는 계산하지 않습니다. 취업규칙에 별도 규정이 있는지는 회사에 확인해 주세요.' };
  }
  if (input.hours15plus === 'no') {
    return { status: 'blocked', code: 'under15h', message: '4주 평균 1주 소정근로시간이 15시간 미만이면 근로기준법 제60조가 적용되지 않아(제18조 제3항), 이 도구로는 계산하지 않습니다.' };
  }
  // 안전장치 3: 구규정 경계 — 규칙 §7·§8-3은 계산 중단을 정했으나, §12 케이스 9(2003년 입사)가
  // 기대 출력을 가진 확정 케이스로 검산돼 있어 두 조항이 충돌한다. 구축에서는 §12(실행 명세)를 따라
  // 계산은 진행하고, 최초 1년 구간이 종전 규정 대상일 수 있음을 경고로 명시한다. (build-note-1021.md 참조)

  var events = buildEvents({ hire: hire, end: end, lowAttendanceYears: input.lowAttendanceYears });
  var totalAccrued = 0;
  events.forEach(function (e) { totalAccrued += e.days; });

  // 사용일수를 발생 순서(FIFO)로 차감해 소멸·잔여를 가른다
  var remainingUsed = input.usedDays || 0;
  var availableNow = 0, expiredUnused = 0;
  var eventRows = events.map(function (e) {
    var consumed = Math.min(e.days, remainingUsed);
    remainingUsed -= consumed;
    var unused = e.days - consumed;
    var expired = cmpDate(end, e.expiryDate) > 0;
    if (expired) expiredUnused += unused; else availableNow += unused;
    return {
      type: e.type, period: e.period, accrualDate: fmtDate(e.accrualDate), expiryDate: fmtDate(e.expiryDate),
      days: e.days, usedHere: consumed, unused: unused, expired: expired
    };
  });

  // 퇴직 정산 (간이 합산 모델, 규칙 §3-3): settlement = 누적 발생 - 사용
  var settlementDays = Math.max(0, totalAccrued - (input.usedDays || 0));

  // 수당
  var stdHours = monthlyStandardHours(input.weeklyHours || 40);
  var dailyWageRaw = null, gross = null, net = null;
  if (input.monthlyWage && input.monthlyWage > 0) {
    dailyWageRaw = input.monthlyWage / stdHours * (input.dailyHours || 8);
    gross = Math.round(settlementDays * dailyWageRaw);
    net = Math.max(0, gross - (input.prepaidAllowance || 0));
  }

  var warnings = [];
  if (cmpDate(hire, parseDate(OLD_RULE_CUTOFF)) <= 0) warnings.push('입사일이 2017년 5월 29일 이전이라 최초 1년 구간의 연차는 종전 규정(1년차 휴가를 15일에 포함하던 규정)이 적용될 수 있습니다. 이 결과는 현행 규정 기준으로 계산한 값이라 최초 1년 구간에서 최대 11일까지 차이가 날 수 있으니, 정확한 정산은 전문가 확인을 권합니다.');
  if (input.workers5plus === 'unknown') warnings.push('상시근로자 수 확인이 필요합니다. 5인 미만 사업장은 법정 연차가 적용되지 않습니다.');
  if (input.hours15plus === 'unknown') warnings.push('주 15시간 미만 근무자는 법정 연차가 적용되지 않습니다. 본인 근무시간을 확인해 주세요.');
  if (input.hasSuspensionPeriod) warnings.push('휴직 등 근로관계가 멈춘 기간이 있었던 해는 출근율 계산 방식이 달라져 이 결과는 참고값입니다. 법정 간주 기간(업무상 재해 휴업·출산전후휴가·육아휴직)은 출근한 것으로 계산하고, 그 밖의 휴직·병가는 회사 규정에 따라 달라질 수 있습니다.');
  if ((input.lowAttendanceYears || []).length > 0) warnings.push('출근율 80% 미만으로 입력한 연도는 제60조 제2항 기준(개근한 개월 수만큼 발생)으로 계산했습니다.');
  if (input.mode === 'retire' && input.promotion === 'yes') warnings.push('연차 사용촉진을 서면으로 받은 경우, 적법한 촉진을 받고도 쓰지 못해 소멸된 연차는 회사의 보상 의무가 없을 수 있습니다(근로기준법 제61조). 다만 퇴직 시점에 남아 있는 연차는 촉진과 무관하게 정산 대상이라는 해석이 있어, 이 예상액을 확정액으로 보지 마세요.');
  if (expiredUnused > 0) warnings.push('이미 사용기간이 지난 미사용 연차 ' + trimNum(expiredUnused) + '일이 포함돼 있습니다. 소멸 후 3년이 지난 수당은 시효로 청구할 수 없고(근로기준법 제49조), 퇴직 시 수당은 퇴직일부터 14일 이내 지급이 원칙입니다(제36조).');
  warnings.push('예상 수당은 통상임금 기준의 조건부 예상액입니다. 통상임금에 포함되는 항목 범위와 회사 규정에 따라 실제 금액은 달라질 수 있습니다.');
  warnings.push('소수점 처리 방식은 법으로 정해져 있지 않아 회사 규정에 따라 달라질 수 있습니다. 이 도구는 원 계산값을 그대로 보여 드립니다.');

  return {
    status: 'ok',
    mode: input.mode,
    hire: fmtDate(hire),
    end: fmtDate(end),
    events: eventRows,
    totalAccrued: totalAccrued,
    usedDays: input.usedDays || 0,
    availableNow: availableNow,
    expiredUnused: expiredUnused,
    settlementDays: settlementDays,
    stdHours: stdHours,
    dailyWageRaw: dailyWageRaw,
    dailyWageDisplay: dailyWageRaw === null ? null : Math.round(dailyWageRaw),
    grossAllowance: gross,
    prepaidAllowance: input.prepaidAllowance || 0,
    netAllowance: net,
    warnings: warnings
  };
}

// ---------- 연차 사용 플래너 (표시 전용 — 발생·정산 계산 의미는 바꾸지 않는다) ----------
// 컨셉 (2026-10-21 확정): "남은 연차로 가장 길게·효율적으로 쉬는 법"
// 공휴일 데이터는 tools/holidays-2027/calc.js의 HOLIDAYS(2027년 확정분)를 이식하고,
// 탐색 범위의 앞부분(2026년)에 필요한 2026-12-25 성탄절 1건을 더했다.
var PLANNER_HOLIDAYS = [
  { name: '성탄절', dates: ['2026-12-25'], substitute: null },
  { name: '신정', dates: ['2027-01-01'], substitute: null },
  { name: '설 연휴', dates: ['2027-02-06', '2027-02-07', '2027-02-08'], substitute: '2027-02-09' },
  { name: '삼일절', dates: ['2027-03-01'], substitute: null },
  { name: '노동절', dates: ['2027-05-01'], substitute: '2027-05-03' },
  { name: '어린이날', dates: ['2027-05-05'], substitute: null },
  { name: '부처님오신날', dates: ['2027-05-13'], substitute: null },
  { name: '현충일', dates: ['2027-06-06'], substitute: null },
  { name: '제헌절', dates: ['2027-07-17'], substitute: '2027-07-19' },
  { name: '광복절', dates: ['2027-08-15'], substitute: '2027-08-16' },
  { name: '추석 연휴', dates: ['2027-09-14', '2027-09-15', '2027-09-16'], substitute: null },
  { name: '개천절', dates: ['2027-10-03'], substitute: '2027-10-04' },
  { name: '한글날', dates: ['2027-10-09'], substitute: '2027-10-11' },
  { name: '성탄절', dates: ['2027-12-25'], substitute: '2027-12-27' }
];
var HOLIDAY_NAME_MAP = {}; // 날짜 -> 표시명 (대체공휴일은 '대체공휴일(원 공휴일명)')
var HOLIDAY_BASE_MAP = {}; // 날짜 -> 원 공휴일명
PLANNER_HOLIDAYS.forEach(function (h) {
  h.dates.forEach(function (d) { HOLIDAY_NAME_MAP[d] = h.name; HOLIDAY_BASE_MAP[d] = h.name; });
  if (h.substitute) {
    HOLIDAY_NAME_MAP[h.substitute] = '대체공휴일(' + h.name + ')';
    HOLIDAY_BASE_MAP[h.substitute] = h.name;
  }
});
function holidayName(dateStr) { return HOLIDAY_NAME_MAP[dateStr] || null; }
function isHoliday(dateStr) { return !!HOLIDAY_BASE_MAP[dateStr]; }

// 연휴 특징 한 줄 (시즌 일반론 수준 — 단정적 여행 추천은 쓰지 않는다)
var FEATURE_NOTES = {
  '신정': '겨울 · 새해 첫날, 한 해를 시작하는 시기',
  '설 연휴': '겨울 한가운데 · 귀성·가족 일정이 몰리는 시기',
  '삼일절': '초봄 · 봄이 시작되는 시기',
  '노동절': '봄 · 나들이하기 좋은 시기',
  '어린이날': '봄 · 가족과 보내기 좋은 시기',
  '부처님오신날': '늦봄 · 초여름이 가까워지는 시기',
  '현충일': '초여름 · 덥기 전 나들이하기 좋은 시기',
  '제헌절': '한여름 · 장마와 겹치기 쉬운 시기',
  '광복절': '한여름 · 무더위가 한창인 시기',
  '추석 연휴': '초가을 · 단풍이 시작되는 무렵',
  '개천절': '가을 · 단풍이 물들기 시작하는 시기',
  '한글날': '가을 · 단풍이 한창인 시기',
  '성탄절': '연말 · 한 해를 마무리하는 시기',
  '주말 연결': '공휴일은 없지만 주말과 이어서 쉬는 구간'
};

function diffDays(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }

// 남은 연차로 만들 수 있는 연휴 조합을 찾는다.
// budgetA: 소진 기한(deadlineStr)까지 쓸 수 있는 올해 연차, budgetB: 내년 연차 (내년 1월 1일부터 사용 가능 가정)
// 후보는 (1) 휴무 덩어리 앞뒤 평일 붙이기 (한쪽 최대 3일) (2) 연속한 휴무 덩어리 사이의 평일을 전부 채우는 잇기, 두 경로로 만든다.
// 반환: {hero, alternatives, all, expiringUnused}
//   hero: 총 일수가 가장 긴 조합 1개. alternatives: 겹치지 않는 효율 순 대안 최대 3개 (서로 다른 달 우선).
//   조합: {start, end, totalDays, leaveDays, leaveDates, name, note, useA, useB}
function buildBestBreaks(fromStr, budgetA, deadlineStr, budgetB) {
  var empty = { hero: null, alternatives: [], all: [], expiringUnused: false };
  var from = parseDate(fromStr);
  if (!from) return empty;
  var bA = Math.max(0, Math.floor(Number(budgetA) || 0));
  var bB = Math.max(0, Math.floor(Number(budgetB) || 0));
  var totalBudget = bA + bB;
  var rangeEnd = addMonths(from, 12);
  var rangeEndStr = fmtDate(rangeEnd);
  var deadline = parseDate(deadlineStr);
  var deadlineStr2 = deadline ? fmtDate(deadline) : rangeEndStr;
  var nextJan1 = (from.getUTCFullYear() + 1) + '-01-01';

  function isRest(str) {
    if (HOLIDAY_BASE_MAP[str]) return true;
    var w = parseDate(str).getUTCDay();
    return w === 0 || w === 6;
  }
  // from..rangeEnd를 날짜 배열로 펼치고 휴무 덩어리를 찾는다
  var days = [];
  for (var d = new Date(from.getTime()); cmpDate(d, rangeEnd) <= 0; d = addDays(d, 1)) days.push(fmtDate(d));
  var blocks = [];
  var cur = null;
  days.forEach(function (s) {
    if (isRest(s)) {
      if (cur) cur.end = s; else cur = { start: s, end: s };
    } else if (cur) { blocks.push(cur); cur = null; }
  });
  if (cur) blocks.push(cur);

  // 후보 구간 [start, end] 안의 근무일이 곧 써야 할 연차 날짜다
  var spanMap = {};
  function addSpan(start, end) {
    var key = start + '|' + end;
    if (spanMap[key]) return;
    var leaveDates = [];
    var s = parseDate(start), e = parseDate(end);
    for (var dd = new Date(s.getTime()); cmpDate(dd, e) <= 0; dd = addDays(dd, 1)) {
      var ks = fmtDate(dd);
      if (!isRest(ks)) leaveDates.push(ks);
    }
    spanMap[key] = { start: start, end: end, totalDays: diffDays(s, e) + 1, leaveDates: leaveDates };
  }
  // 경로 1: 덩어리 앞뒤 붙이기 (한쪽 최대 3일, 날짜는 days 배열 안에서만)
  blocks.forEach(function (b) {
    var bi = days.indexOf(b.start), ei = days.indexOf(b.end);
    var leftRun = [];
    for (var i = bi - 1; i >= 0 && !isRest(days[i]) && leftRun.length < 3; i--) leftRun.unshift(days[i]);
    var rightRun = [];
    for (var j = ei + 1; j < days.length && !isRest(days[j]) && rightRun.length < 3; j++) rightRun.push(days[j]);
    for (var a = 0; a <= leftRun.length; a++) {
      for (var bb = 0; bb <= rightRun.length; bb++) {
        if (a + bb < 1 || a + bb > totalBudget) continue;
        addSpan(a > 0 ? leftRun[leftRun.length - a] : b.start, bb > 0 ? rightRun[bb - 1] : b.end);
      }
    }
  });
  // 경로 2: 연속한 덩어리 잇기 (사이 평일을 전부 채운다).
  // 잇는 구간의 누적 연차는 최대 4일까지만 허용한다 — P4 공휴일 플래너에서 검증된 잇기 조합
  // (10월 개천절~한글날·성탄~신정 등)의 가장 긴 간격이 4일이며, 그 이상 이으면 주말 덩어리를
  // 연쇄로 묶은 비현실적인 초장기 구간이 추천을 지배하게 된다.
  var BRIDGE_GAP_MAX = 4;
  for (var x = 0; x < blocks.length; x++) {
    var gapLeave = 0;
    for (var y = x + 1; y < blocks.length; y++) {
      var prevEnd = parseDate(blocks[y - 1].end), thisStart = parseDate(blocks[y].start);
      for (var gd = addDays(prevEnd, 1); cmpDate(gd, thisStart) < 0; gd = addDays(gd, 1)) gapLeave++;
      if (gapLeave > Math.min(totalBudget, BRIDGE_GAP_MAX)) break;
      if (gapLeave >= 1) addSpan(blocks[x].start, blocks[y].end);
    }
  }

  // 예산 차감 시뮬레이션: 날짜순으로, 소진 기한 이내 날짜와 내년 날짜 모두 A(소멸이 빠른 쪽)부터 쓴다.
  // 기한이 지난 날짜는 A로 못 쓰고, 내년 1월 1일 전 날짜는 B로 못 쓴다. 못 채우면 후보 무효.
  function fund(leaveDates) {
    var aLeft = bA, bLeft = bB, useA = 0, useB = 0;
    for (var i = 0; i < leaveDates.length; i++) {
      var ds = leaveDates[i];
      var canA = ds <= deadlineStr2;
      var canB = ds >= nextJan1;
      if (canA && aLeft > 0) { aLeft--; useA++; }
      else if (canB && bLeft > 0) { bLeft--; useB++; }
      else return null;
    }
    return { useA: useA, useB: useB };
  }
  function comboName(start, end) {
    var names = [];
    var s = parseDate(start), e = parseDate(end);
    for (var dd = new Date(s.getTime()); cmpDate(dd, e) <= 0; dd = addDays(dd, 1)) {
      var nm = HOLIDAY_BASE_MAP[fmtDate(dd)];
      if (nm && names.indexOf(nm) < 0) names.push(nm);
    }
    if (!names.length) return '주말 연결';
    return names.length === 1 ? names[0] : names[0] + '~' + names[names.length - 1];
  }
  var candidates = [];
  Object.keys(spanMap).forEach(function (k) {
    var sp = spanMap[k];
    if (sp.totalDays < 3 || sp.leaveDates.length < 1) return;
    var f = fund(sp.leaveDates);
    if (!f) return;
    var name = comboName(sp.start, sp.end);
    candidates.push({
      start: sp.start, end: sp.end, totalDays: sp.totalDays,
      leaveDays: sp.leaveDates.length, leaveDates: sp.leaveDates,
      name: name, note: FEATURE_NOTES[name.split('~')[0]] || FEATURE_NOTES['주말 연결'],
      useA: f.useA, useB: f.useB,
      eff: Math.round((sp.totalDays / sp.leaveDates.length) * 100) / 100
    });
  });
  if (!candidates.length || totalBudget < 1) {
    // 조합이 하나도 없어도, 올해 연차가 있고 소진 기한이 탐색 범위 안에 있으면 소멸 임박으로 알린다
    var noComboExpiring = bA > 0 && deadline && cmpDate(deadline, from) >= 0 && cmpDate(deadline, rangeEnd) <= 0;
    return { hero: null, alternatives: [], all: [], expiringUnused: noComboExpiring };
  }

  function overlaps(p, q) { return p.start <= q.end && q.start <= p.end; }
  var heroPool = candidates.slice().sort(function (p, q) {
    if (q.totalDays !== p.totalDays) return q.totalDays - p.totalDays;
    if (p.leaveDays !== q.leaveDays) return p.leaveDays - q.leaveDays;
    if (q.eff !== p.eff) return q.eff - p.eff;
    return p.start < q.start ? -1 : 1;
  });
  var hero = heroPool[0];
  var cumA = hero.useA, cumB = hero.useB;
  var altPool = candidates.filter(function (c) { return c !== hero && !overlaps(c, hero); }).sort(function (p, q) {
    if (q.eff !== p.eff) return q.eff - p.eff;
    if (q.totalDays !== p.totalDays) return q.totalDays - p.totalDays;
    return p.start < q.start ? -1 : 1;
  });
  var picked = [];
  function tryPick(c, usedMonths) {
    if (picked.length >= 3) return false;
    if (usedMonths && usedMonths[c.start.slice(0, 7)]) return false;
    for (var i = 0; i < picked.length; i++) if (overlaps(c, picked[i])) return false;
    if (cumA + c.useA > bA || cumB + c.useB > bB) return false;
    picked.push(c); cumA += c.useA; cumB += c.useB;
    return true;
  }
  var heroMonth = {}; heroMonth[hero.start.slice(0, 7)] = true;
  altPool.forEach(function (c) {
    var used = Object.assign({}, heroMonth);
    picked.forEach(function (p) { used[p.start.slice(0, 7)] = true; });
    tryPick(c, used);
  });
  if (picked.length < 3) altPool.forEach(function (c) { tryPick(c, null); });

  // 올해 연차가 있는데도 선택된 조합이 올해 연차를 전혀 안 쓰면 소멸 임박으로 본다.
  // 이 경우 소진 기한 안에서 만드는 가장 긴 조합을 대안 맨 앞에 강제 포함한다 (예산 허용 시).
  var expiringUnused = false;
  var selectedUseA = cumA;
  if (bA > 0 && deadline && cmpDate(deadline, from) >= 0 && cmpDate(deadline, rangeEnd) <= 0 && selectedUseA === 0) {
    expiringUnused = true;
    var forcedPool = candidates.filter(function (c) {
      return c !== hero && !overlaps(c, hero) && c.end <= deadlineStr2 && c.useA >= 1;
    }).sort(function (p, q) {
      if (q.totalDays !== p.totalDays) return q.totalDays - p.totalDays;
      if (q.eff !== p.eff) return q.eff - p.eff;
      return p.start < q.start ? -1 : 1;
    });
    var forced = forcedPool[0];
    if (forced && forced.useA <= bA) {
      picked = picked.filter(function (c) { return c !== forced && !overlaps(c, forced); });
      picked.unshift(forced);
      picked = picked.slice(0, 3);
    }
  }
  return { hero: hero, alternatives: picked, all: [hero].concat(picked), expiringUnused: expiringUnused };
}

// 월간 달력 그리드 (일요일 시작). cell: {date, day, dow, isWeekend, holiday}
function buildMonthGrid(year, month) {
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  var startDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  var daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  var weeks = [], week = [];
  for (var i = 0; i < startDow; i++) week.push(null);
  for (var d = 1; d <= daysInMonth; d++) {
    var dt = new Date(Date.UTC(year, month - 1, d, 12, 0, 0));
    var dow = dt.getUTCDay();
    week.push({
      date: fmtDate(dt), day: d, dow: dow,
      isWeekend: dow === 0 || dow === 6,
      holiday: holidayName(fmtDate(dt))
    });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return { ym: year + '-' + p2(month), year: year, month: month, weeks: weeks };
}

// ---------- 표시 정책 (규칙 §5-3: 원값 보존 + 4종 표시) ----------
function applyDayPolicy(raw, policy) {
  switch (policy) {
    case 2: return Math.ceil(raw * 2) / 2;      // 0.5일 단위 올림
    case 3: return Math.ceil(raw);               // 1일 단위 올림
    case 4: return Math.floor(raw);              // 정수 버림
    default: return Math.round(raw * 10) / 10;   // 소수 첫째 자리
  }
}
function trimNum(v) {
  return (Math.round(v * 100) / 100).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}
function formatDays(v) {
  return (Math.round(v * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
function formatWon(v) {
  return Math.round(v).toLocaleString('ko-KR');
}
// 입력 검증 (P1과 동일 원칙: 자동 교정 없이 오류로 알린다)
function parseField(raw, label, max) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { ok: false, message: label + '을(를) 입력해 주세요.' };
  }
  var v = Number(String(raw).trim());
  if (!isFinite(v)) return { ok: false, message: label + '은(는) 숫자로 입력해 주세요.' };
  if (v < 0) return { ok: false, message: label + '은(는) 음수가 될 수 없습니다.' };
  if (max !== undefined && v > max) return { ok: false, message: label + '은(는) ' + max.toLocaleString('ko-KR') + ' 이하로 입력해 주세요.' };
  return { ok: true, value: v };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OLD_RULE_CUTOFF: OLD_RULE_CUTOFF,
    parseDate: parseDate, fmtDate: fmtDate, addMonths: addMonths, addYears: addYears, addDays: addDays,
    annualDaysForYear: annualDaysForYear, monthlyStandardHours: monthlyStandardHours,
    buildEvents: buildEvents, calculate: calculate,
    holidayName: holidayName, isHoliday: isHoliday, buildBestBreaks: buildBestBreaks, buildMonthGrid: buildMonthGrid, FEATURE_NOTES: FEATURE_NOTES,
    applyDayPolicy: applyDayPolicy, formatDays: formatDays, formatWon: formatWon, parseField: parseField
  };
}
