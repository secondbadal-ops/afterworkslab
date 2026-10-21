// 2027 공휴일 + 잔여 연차 플래너 — 데이터와 계산 로직
// 정본 데이터: holidays-2027-dataset-verified-1021.md (2026-10-21 확정, 불일치 0건)
// 출처 기준: 우주항공청 2027년 월력요항(2026-06-29 발표), 공휴일에 관한 법률·관공서의 공휴일에 관한 규정(시행 2026-05-11)
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

// ---------- 확정 데이터 (정본 표 13행) ----------
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

// ---------- 연차 조합 (plan) ----------
// 정본 데이터셋(holidays-2027-dataset-verified-1021.md)의 '연차 조합 대표값' 6개만 쓴다.
// 원문 대조로 검증되지 않은 조합은 달력 계산으로 만들 수 있어도 넣지 않는다 (2026-10-21 확정).
// leaveDates만 정하면 start/end/totalDays는 아래 함수로 계산해 검증한다.
// start/end는 쉬는 구간의 첫날과 마지막 날(주말·공휴일·연차로만 이어진 연속 구간).
var PLANS = [
  { id: 'seol-front-1', title: '설 앞 금요일', leaveDates: ['2027-02-05'], start: '2027-02-05', end: '2027-02-09' },
  { id: 'may-1', title: '어린이날 앞 화요일', leaveDates: ['2027-05-04'], start: '2027-05-01', end: '2027-05-05' },
  { id: 'buddha-1', title: '부처님오신날 뒤 금요일', leaveDates: ['2027-05-14'], start: '2027-05-13', end: '2027-05-16' },
  { id: 'chuseok-2', title: '추석 앞뒤 월·금', leaveDates: ['2027-09-13', '2027-09-17'], start: '2027-09-11', end: '2027-09-19' },
  { id: 'oct-bridge-4', title: '10월 개천절~한글날 잇기', leaveDates: ['2027-10-05', '2027-10-06', '2027-10-07', '2027-10-08'], start: '2027-10-02', end: '2027-10-11' },
  { id: 'xmas-front-1', title: '성탄 앞 금요일', leaveDates: ['2027-12-24'], start: '2027-12-24', end: '2027-12-27' }
];

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
// 구간 [start,end]의 모든 날이 주말·공휴일·연차 중 하나인지, 연차 날짜가 정확히 그 안의 평일 근무일과 같은지 검증
function validatePlan(plan) {
  var set = holidaySet();
  var s = parseDate(plan.start), e = parseDate(plan.end);
  if (!s || !e || diffDays(s, e) < 0) return { ok: false, reason: '구간 날짜 오류' };
  var leave = {};
  plan.leaveDates.forEach(function (d) { leave[d] = true; });
  for (var d = new Date(s.getTime()); diffDays(d, e) >= 0; d = addDays(d, 1)) {
    var key = fmtDate(d);
    if (isWeekend(d) || set[key]) continue;
    if (!leave[key]) return { ok: false, reason: key + '는 연차로 지정되지 않은 근무일입니다' };
  }
  for (var i = 0; i < plan.leaveDates.length; i++) {
    var ld = plan.leaveDates[i];
    if (!isWorkingDay(ld, set)) return { ok: false, reason: ld + '는 근무일이 아닙니다' };
    if (diffDays(s, parseDate(ld)) < 0 || diffDays(parseDate(ld), e) < 0) return { ok: false, reason: ld + '가 구간 밖에 있습니다' };
  }
  return { ok: true, totalDays: diffDays(s, e) + 1, leaveDays: plan.leaveDates.length };
}
function planWithTotals(plan) {
  var v = validatePlan(plan);
  return {
    id: plan.id, title: plan.title, leaveDates: plan.leaveDates.slice(),
    start: plan.start, end: plan.end,
    leaveDays: plan.leaveDates.length,
    totalDays: v.ok ? v.totalDays : null,
    valid: v.ok, reason: v.ok ? '' : v.reason,
    efficiency: v.ok ? Math.round((v.totalDays / plan.leaveDates.length) * 100) / 100 : null
  };
}
// 잔여 연차 필터: 남은 연차로 가능한 조합만, 효율(총 휴일 ÷ 연차) 높은 순 -> 총 휴일 긴 순 -> 시작일 순
function filterPlans(remaining) {
  var r = Number(remaining);
  if (!isFinite(r) || r < 0) return { status: 'error', message: '잔여 연차는 0 이상의 숫자로 입력해 주세요.' };
  var list = PLANS.map(planWithTotals).filter(function (p) { return p.valid && p.leaveDays <= r; });
  list.sort(function (a, b) {
    if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
    if (b.totalDays !== a.totalDays) return b.totalDays - a.totalDays;
    return a.start < b.start ? -1 : 1;
  });
  return { status: 'ok', remaining: r, count: list.length, plans: list };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HOLIDAYS: HOLIDAYS, PLANS: PLANS, SUMMARY: SUMMARY,
    parseDate: parseDate, fmtDate: fmtDate, addDays: addDays, diffDays: diffDays,
    isWeekend: isWeekend, weekdayKo: weekdayKo, shortDate: shortDate,
    allHolidayDates: allHolidayDates, holidaySet: holidaySet, isWorkingDay: isWorkingDay,
    validatePlan: validatePlan, planWithTotals: planWithTotals, filterPlans: filterPlans
  };
}
