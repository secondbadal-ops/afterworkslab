// MM·MH 공수 변환 계산기 — 계산 로직 (확정 규칙: calc-rules-draft-1019.md, 2026-10-19 찰리 승인)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.

// 월 기준시간은 독립 입력으로 받지 않고 '기준 하루 근무시간 × 월 근무일'로 파생한다.
function monthlyStandardHours(stdHoursPerDay, workdaysPerMonth) {
  return stdHoursPerDay * workdaysPerMonth;
}

// 인력 1행의 공수. row = {count, days, hoursPerDay, ratePct}
function rowEffort(row, stdMonthlyHours) {
  var mh = row.count * row.days * row.hoursPerDay * (row.ratePct / 100);
  var mm = stdMonthlyHours > 0 ? mh / stdMonthlyHours : NaN;
  var md = row.count * row.days * (row.ratePct / 100);
  return { mh: mh, mm: mm, md: md };
}

// 빠른 단위 변환. unit: 'mm' | 'mh' | 'md'. MD는 기준 하루 근무시간으로 환산한다.
function convertUnits(value, unit, stdMonthlyHours, stdHoursPerDay) {
  var mh;
  if (unit === 'mm') mh = value * stdMonthlyHours;
  else if (unit === 'md') mh = value * stdHoursPerDay;
  else mh = value;
  return {
    mh: mh,
    mm: stdMonthlyHours > 0 ? mh / stdMonthlyHours : NaN,
    md: stdHoursPerDay > 0 ? mh / stdHoursPerDay : NaN
  };
}

function totalEffort(rows, stdMonthlyHours) {
  var total = { mh: 0, mm: 0, md: 0, rows: [] };
  for (var i = 0; i < rows.length; i++) {
    var r = rowEffort(rows[i], stdMonthlyHours);
    total.rows.push(r);
    total.mh += r.mh;
    total.md += r.md;
  }
  total.mm = stdMonthlyHours > 0 ? total.mh / stdMonthlyHours : NaN;
  return total;
}

// 입력값 상한 (U-5, 2026-10-20 찰리 확정 — 비정상 입력 방지용 넉넉한 상한)
var LIMITS = {
  count: 1000,          // 인원(명)
  days: 3660,           // 근무일(일) — 약 10년치
  hoursPerDay: 24,      // 하루 근무시간·기준 하루 근무시간
  workdaysPerMonth: 31, // 월 근무일
  maxRows: 100          // 인력 행 수
};

// 입력 검증. 값은 문자열 그대로 받는다 (자동으로 글자를 떼어 내고 계산하지 않는다).
// max를 주면 상한 검증까지 한다 (U-5).
// 반환: {ok:true, value:number} 또는 {ok:false, message:string}
function parseField(raw, label, max) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { ok: false, message: label + '을(를) 입력해 주세요.' };
  }
  var v = Number(String(raw).trim());
  if (!isFinite(v)) {
    return { ok: false, message: label + '은(는) 숫자로 입력해 주세요.' };
  }
  if (v < 0) {
    return { ok: false, message: label + '은(는) 음수가 될 수 없습니다.' };
  }
  if (max !== undefined && v > max) {
    return { ok: false, message: label + '은(는) ' + max.toLocaleString('ko-KR') + ' 이하로 입력해 주세요.' };
  }
  return { ok: true, value: v };
}

function parseRate(raw) {
  var r = parseField(raw, '참여율');
  if (!r.ok) return r;
  if (r.value > 100) {
    return { ok: false, message: '참여율은 100%를 넘을 수 없습니다.' };
  }
  return r;
}

// 표시 단계에서만 반올림한다. 내부 계산은 반올림하지 않는다.
function formatMH(v) {
  return v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function formatMM(v) {
  return v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMD(v) {
  return v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LIMITS: LIMITS,
    monthlyStandardHours: monthlyStandardHours,
    convertUnits: convertUnits,
    rowEffort: rowEffort,
    totalEffort: totalEffort,
    parseField: parseField,
    parseRate: parseRate,
    formatMH: formatMH,
    formatMM: formatMM,
    formatMD: formatMD
  };
}
