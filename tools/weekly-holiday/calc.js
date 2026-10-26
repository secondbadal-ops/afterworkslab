// 주휴수당 계산기 — 계산 로직 (확정 규칙: demand-check-weekly-holiday-1025.md, 2026-10-25)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.
// 확정 공식: 주휴시간 = min(주 소정근로시간 ÷ 40 × 8, 8) — 단, 4주 평균 주 15시간 미만이거나 개근이 아니면 0
//   주휴수당 = 주휴시간 × 기본시급, 기대 주급 = 주 기본급 + 주휴수당
//   월 환산 시간 = round((주 시간 + 주휴시간) × 365 ÷ 84), 월급 환산 = 시급 × 월 유급시간
//   포함 시급 역산: 기본시급 = 포함 시급 × 주 시간 ÷ (주 시간 + 주휴시간), 판정은 교차곱으로 한다
(function () {
  'use strict';

  var MIN_WAGES = { 2025: 10030, 2026: 10320, 2027: 10700 };
  var MAX_HOURLY_WAGE = 10000000;
  var MAX_WEEKLY_PAY = 100000000;
  var MAX_WEEKLY_HOURS = 80;
  var MAX_WEEKS = 520;
  var LIMITATION_WEEKS = 156; // 임금채권 소멸시효 3년 ≒ 156주
  var WEEKS_PER_MONTH = 365 / 84; // 365일 ÷ 7일 ÷ 12개월 ≒ 4.3452주

  function isValidHourly(v) {
    return typeof v === 'number' && isFinite(v) && v > 0 && v <= MAX_HOURLY_WAGE;
  }
  function isValidHours(v) {
    return typeof v === 'number' && isFinite(v) && v > 0 && v <= MAX_WEEKLY_HOURS;
  }
  function holidayHours(weeklyHours, attendedAll) {
    if (!isValidHours(weeklyHours)) return null;
    if (weeklyHours < 15 || attendedAll === false) return 0;
    return Math.min(weeklyHours / 40 * 8, 8);
  }

  // input: { hourlyWage, weeklyHours, attendedAll, actualWeeklyPay, weeksWorked }
  // actualWeeklyPay·weeksWorked는 null 허용. 금액은 원, 시간은 소수 허용.
  function compute(input) {
    if (!input) return null;
    if (!isValidHourly(input.hourlyWage)) return null;
    if (!isValidHours(input.weeklyHours)) return null;
    var actual = (input.actualWeeklyPay === null || input.actualWeeklyPay === undefined) ? null : input.actualWeeklyPay;
    if (actual !== null && (typeof actual !== 'number' || !isFinite(actual) || actual < 0 || actual > MAX_WEEKLY_PAY)) return null;
    var weeks = (input.weeksWorked === null || input.weeksWorked === undefined) ? null : input.weeksWorked;
    if (weeks !== null && (typeof weeks !== 'number' || !isFinite(weeks) || Math.floor(weeks) !== weeks || weeks < 0 || weeks > MAX_WEEKS)) return null;

    var H = input.weeklyHours;
    var attended = input.attendedAll !== false;
    var eligibleHours = H >= 15;
    var eligible = eligibleHours && attended;
    var h = holidayHours(H, attended);

    var weeklyBasePay = Math.round(H * input.hourlyWage);
    var weeklyHolidayPay = Math.round(h * input.hourlyWage);
    var expectedWeeklyPay = weeklyBasePay + weeklyHolidayPay;

    var monthlyPaidHours = Math.round((H + h) * WEEKS_PER_MONTH);
    var monthlyWorkHours = Math.round(H * WEEKS_PER_MONTH);
    var monthlyPay = Math.round(input.hourlyWage * monthlyPaidHours);
    var monthlyBasePay = Math.round(input.hourlyWage * monthlyWorkHours);
    var monthlyHolidayPay = monthlyPay - monthlyBasePay;

    var weeklyShortfall = actual !== null ? Math.max(expectedWeeklyPay - actual, 0) : null;
    var cumulativeShortfall = (weeklyShortfall !== null && weeks !== null) ? weeklyShortfall * weeks : null;
    var unpaidHolidayTotal = weeks !== null ? weeklyHolidayPay * weeks : null;

    return {
      eligible: eligible,
      eligibleHours: eligibleHours,
      attended: attended,
      ineligibleReason: eligible ? null : (!eligibleHours ? 'hours' : 'attendance'),
      holidayHours: h,
      weeklyBasePay: weeklyBasePay,
      weeklyHolidayPay: weeklyHolidayPay,
      expectedWeeklyPay: expectedWeeklyPay,
      monthlyPaidHours: monthlyPaidHours,
      monthlyWorkHours: monthlyWorkHours,
      monthlyHolidayHours: monthlyPaidHours - monthlyWorkHours,
      monthlyPay: monthlyPay,
      monthlyBasePay: monthlyBasePay,
      monthlyHolidayPay: monthlyHolidayPay,
      weeklyShortfall: weeklyShortfall,
      cumulativeShortfall: cumulativeShortfall,
      unpaidHolidayTotal: unpaidHolidayTotal,
      overLimitation: weeks !== null && weeks > LIMITATION_WEEKS
    };
  }

  // '주휴 포함 시급' 역산 검증. input: { includedWage, weeklyHours, year } — 개근 전제.
  function verifyIncluded(input) {
    if (!input) return null;
    var mw = MIN_WAGES[input.year];
    if (!mw) return null;
    if (!isValidHourly(input.includedWage)) return null;
    if (!isValidHours(input.weeklyHours)) return null;
    var H = input.weeklyHours;
    var h = H >= 15 ? Math.min(H / 40 * 8, 8) : 0;
    var baseWage = input.includedWage * H / (H + h);
    var pass = input.includedWage * H >= mw * (H + h);
    var requiredIncluded = Math.ceil(mw * (H + h) / H);
    var weeklyTotal = Math.round(input.includedWage * H);
    var basePart = Math.round(baseWage * H);
    return {
      minWage: mw,
      holidayHours: h,
      hasHoliday: h > 0,
      baseWage: baseWage,
      pass: pass,
      requiredIncluded: requiredIncluded,
      weeklyTotal: weeklyTotal,
      basePart: basePart,
      holidayPart: weeklyTotal - basePart
    };
  }

  var api = {
    MIN_WAGES: MIN_WAGES,
    MAX_WEEKLY_HOURS: MAX_WEEKLY_HOURS,
    MAX_WEEKS: MAX_WEEKS,
    LIMITATION_WEEKS: LIMITATION_WEEKS,
    holidayHours: holidayHours,
    compute: compute,
    verifyIncluded: verifyIncluded
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.WeeklyHolidayCalc = api;
  }
})();
