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
    applyDayPolicy: applyDayPolicy, formatDays: formatDays, formatWon: formatWon, parseField: parseField
  };
}
