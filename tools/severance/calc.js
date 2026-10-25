// 퇴직금 계산기 — 계산 로직 (확정 규칙: demand-check-severance-1024.md, 2026-10-24)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.
// 확정 공식: 세전 퇴직금 = 적용 1일 임금 × 30 × 재직일수 ÷ 365
//   적용 1일 임금 = max(1일 평균임금, 1일 통상임금[입력 시])
//   1일 평균임금 = (3개월 임금 + 연간 상여×3/12 + 전년도 연차수당×3/12) ÷ 3개월 기간 일수
//   1일 통상임금 = 월 통상임금 ÷ 209 × 8 (주 40시간 기준)
//   퇴직 시 미사용 연차수당 = 1일 통상임금 × 미사용 연차일수 (평균임금에는 넣지 않는다)
(function () {
  'use strict';

  var MAX_MONEY = 100000000000; // 1천억 원 — 입력 상한
  var MAX_LEAVE_DAYS = 100;

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) {
    return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }
  // civil date -> serial day (Howard Hinnant days_from_civil), 1970-01-01 = 0
  function daysFromCivil(y, m, d) {
    var yy = m <= 2 ? y - 1 : y;
    var era = Math.floor(yy / 400);
    var yoe = yy - era * 400;
    var mp = (m + 9) % 12;
    var doy = Math.floor((153 * mp + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function civilFromDays(z) {
    var zz = z + 719468;
    var era = Math.floor(zz / 146097);
    var doe = zz - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var y = yoe + era * 400;
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp < 10 ? mp + 3 : mp - 9;
    return { y: m <= 2 ? y + 1 : y, m: m, d: d };
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function formatDays(z) {
    var c = civilFromDays(z);
    return c.y + '-' + pad2(c.m) + '-' + pad2(c.d);
  }
  // 'YYYY-MM-DD' -> serial day or null (실재하지 않는 날짜는 null)
  function parseDate(str) {
    if (typeof str !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    return daysFromCivil(y, mo, d);
  }
  // serial day에 개월을 더한다 (월말 클램프)
  function addMonths(z, months) {
    var c = civilFromDays(z);
    var total = (c.y * 12 + (c.m - 1)) + months;
    var y = Math.floor(total / 12);
    var mo = total - y * 12 + 1;
    var d = Math.min(c.d, daysInMonth(y, mo));
    return daysFromCivil(y, mo, d);
  }
  function isValidMoney(v) {
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= MAX_MONEY;
  }
  function dailyOrdinary(monthlyOrdinary) {
    if (!isValidMoney(monthlyOrdinary) || monthlyOrdinary <= 0) return null;
    return monthlyOrdinary / 209 * 8;
  }

  // input: { hire, last, wage3m, annualBonus, annualLeavePrior, monthlyOrdinary, unusedLeaveDays, weeklyHoursOk }
  // 날짜는 'YYYY-MM-DD' 문자열, 금액은 원 단위 숫자, monthlyOrdinary·unusedLeaveDays는 null 허용.
  function compute(input) {
    if (!input) return null;
    var hire = parseDate(input.hire);
    var last = parseDate(input.last);
    if (hire === null || last === null || last < hire) return null;
    if (!isValidMoney(input.wage3m)) return null;
    var bonus = (input.annualBonus === null || input.annualBonus === undefined) ? 0 : input.annualBonus;
    var leavePrior = (input.annualLeavePrior === null || input.annualLeavePrior === undefined) ? 0 : input.annualLeavePrior;
    if (!isValidMoney(bonus) || !isValidMoney(leavePrior)) return null;
    var monthlyOrd = (input.monthlyOrdinary === null || input.monthlyOrdinary === undefined || input.monthlyOrdinary === 0)
      ? null : input.monthlyOrdinary;
    if (monthlyOrd !== null && !isValidMoney(monthlyOrd)) return null;
    var unused = (input.unusedLeaveDays === null || input.unusedLeaveDays === undefined) ? null : input.unusedLeaveDays;
    if (unused !== null && (typeof unused !== 'number' || !isFinite(unused) || unused < 0 || unused > MAX_LEAVE_DAYS)) return null;

    var serviceDays = last - hire + 1;
    var retirement = last + 1;
    var periodStart = addMonths(retirement, -3);
    var periodDays = retirement - periodStart;

    var wageForAvg = input.wage3m + bonus * 3 / 12 + leavePrior * 3 / 12;
    var dailyAvg = wageForAvg / periodDays;
    var dailyOrd = monthlyOrd !== null ? dailyOrdinary(monthlyOrd) : null;
    var appliedDaily = dailyAvg;
    var appliedBasis = 'avg';
    if (dailyOrd !== null && dailyOrd > dailyAvg) {
      appliedDaily = dailyOrd;
      appliedBasis = 'ordinary';
    }

    var weeklyOk = input.weeklyHoursOk !== false;
    var eligible = serviceDays >= 365 && weeklyOk;
    var severanceRaw = appliedDaily * 30 * serviceDays / 365;
    var severance = eligible ? Math.round(severanceRaw) : 0;

    var leaveAllowance = null;
    var leaveNeedsOrdinary = false;
    if (unused !== null && unused > 0) {
      if (dailyOrd === null) {
        leaveNeedsOrdinary = true;
      } else {
        leaveAllowance = Math.round(dailyOrd * unused);
      }
    } else if (unused !== null) {
      leaveAllowance = 0;
    }
    var totalPayout = leaveAllowance !== null ? severance + leaveAllowance : severance;

    return {
      serviceDays: serviceDays,
      retirementDate: formatDays(retirement),
      periodStart: formatDays(periodStart),
      periodEnd: formatDays(last),
      periodDays: periodDays,
      wageForAvg: wageForAvg,
      dailyAvg: dailyAvg,
      dailyOrd: dailyOrd,
      appliedDaily: appliedDaily,
      appliedBasis: appliedBasis,
      eligible: eligible,
      weeklyOk: weeklyOk,
      severance: severance,
      leaveAllowance: leaveAllowance,
      leaveNeedsOrdinary: leaveNeedsOrdinary,
      totalPayout: totalPayout
    };
  }

  var api = {
    MAX_MONEY: MAX_MONEY,
    MAX_LEAVE_DAYS: MAX_LEAVE_DAYS,
    parseDate: parseDate,
    formatDays: formatDays,
    addMonths: addMonths,
    dailyOrdinary: dailyOrdinary,
    compute: compute
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.SeveranceCalc = api;
  }
})();
