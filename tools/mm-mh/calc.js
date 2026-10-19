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

// 입력 검증. 값은 문자열 그대로 받는다 (자동으로 글자를 떼어 내고 계산하지 않는다).
// 반환: {ok:true, value:number} 또는 {ok:false, message:string}
function parseField(raw, label) {
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
    monthlyStandardHours: monthlyStandardHours,
    rowEffort: rowEffort,
    totalEffort: totalEffort,
    parseField: parseField,
    parseRate: parseRate,
    formatMH: formatMH,
    formatMM: formatMM,
    formatMD: formatMD
  };
}
