// 프로젝트 견적 시뮬레이터 — 계산 로직 (확정 규칙: calc-rules-draft-1019.md, 2026-10-19 찰리 승인)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.
// 공수 계산식은 도구 A(mm-mh)와 같은 식을 쓴다 (교차 일치 검증 대상).

var VAT_RATE = 0.1; // 부가가치세 법정 세율. 새로 정한 값이 아니라 현행 세율을 그대로 쓴다.

// 월 기준시간은 독립 입력으로 받지 않고 '기준 하루 근무시간 × 월 근무일'로 파생한다 (도구 A와 동일).
function monthlyStandardHours(hoursPerDay, workdaysPerMonth) {
  return hoursPerDay * workdaysPerMonth;
}

// 인력 1행의 공수와 인건비.
// row = {count, days, rateBasis: 'hour'|'day'|'month', unitPrice, ratePct}
// ctx = {hoursPerDay, workdaysPerMonth, stdMonthlyHours}
function rowCost(row, ctx) {
  var md = row.count * row.days * (row.ratePct / 100);
  var mh = md * ctx.hoursPerDay;
  var mm = ctx.stdMonthlyHours > 0 ? mh / ctx.stdMonthlyHours : NaN;
  var months = ctx.workdaysPerMonth > 0 ? row.days / ctx.workdaysPerMonth : NaN;
  var cost;
  if (row.rateBasis === 'hour') {
    cost = mh * row.unitPrice;
  } else if (row.rateBasis === 'day') {
    cost = md * row.unitPrice;
  } else { // 'month' — 투입 개월은 근무일 ÷ 월 근무일로 환산한다 (확정 변경 사항, U-3)
    cost = row.count * months * (row.ratePct / 100) * row.unitPrice;
  }
  return { md: md, mh: mh, mm: mm, months: months, cost: cost };
}

// 전체 견적. add = {overheadPct, techPct, directExpense, vatMode: 'separate'|'included'}
// 가산 적용 기준 (확정 변경 사항 3번): 제경비 = 직접인건비 × 요율,
// 기술료 = (직접인건비 + 제경비) × 요율, 직접경비는 금액 직접 입력.
function estimate(rows, ctx, add) {
  var out = {
    rows: [], totalMD: 0, totalMH: 0, totalMM: 0, periodDays: 0,
    labor: 0, overhead: 0, tech: 0, directExpense: add.directExpense,
    subtotal: 0, vat: 0, grandTotal: 0
  };
  for (var i = 0; i < rows.length; i++) {
    var r = rowCost(rows[i], ctx);
    out.rows.push(r);
    out.totalMD += r.md;
    out.totalMH += r.mh;
    out.labor += r.cost;
    // 최장 인력 투입기간은 실제로 참여하는(참여율 0% 초과) 인력만으로 정한다 (2026-10-19 GPT 검수 P2 반영).
    if (rows[i].ratePct > 0 && rows[i].days > out.periodDays) out.periodDays = rows[i].days;
  }
  out.totalMM = ctx.stdMonthlyHours > 0 ? out.totalMH / ctx.stdMonthlyHours : NaN;
  out.overhead = out.labor * (add.overheadPct / 100);
  out.tech = (out.labor + out.overhead) * (add.techPct / 100);
  out.subtotal = out.labor + out.overhead + out.tech + out.directExpense;
  if (add.vatMode === 'included') {
    // 총합이 부가세 포함 금액. 세액은 포함 금액에서 역산해 내포액으로만 표시한다.
    out.grandTotal = out.subtotal;
    out.vat = out.subtotal - out.subtotal / (1 + VAT_RATE);
  } else {
    out.vat = out.subtotal * VAT_RATE;
    out.grandTotal = out.subtotal + out.vat;
  }
  return out;
}

// 입력값 상한 (U-5, 2026-10-20 찰리 확정 — 비정상 입력 방지용 넉넉한 상한. 도구 A와 공통 항목은 같은 값)
var LIMITS = {
  count: 1000,            // 인원(명)
  days: 3660,             // 근무일(일) — 약 10년치
  hoursPerDay: 24,        // 기준 하루 근무시간
  workdaysPerMonth: 31,   // 월 근무일
  unitPrice: 10000000000, // 단가 100억 원
  directExpense: 100000000000, // 직접경비 1,000억 원
  maxRows: 100            // 인력 행 수
};

// 입력 검증. 값은 문자열 그대로 받는다 (자동으로 글자를 떼어 내고 계산하지 않는다). 도구 A와 같은 규칙.
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

// 선택 항목용: 빈 칸이면 0으로 본다 (가산 항목 기본값 0 규칙). 값이 있으면 같은 검증 규칙을 적용한다.
function parseOptional(raw, label, max) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { ok: true, value: 0 };
  }
  return parseField(raw, label, max);
}

// 가산 요율(제경비·기술료)용: 빈 칸이면 0. 참여율과 달리 100% 상한을 두지 않는다.
// 제경비율은 실무 기준이 110~150%라 100%를 넘을 수 있다 (2026-10-19 GPT 검수 지적, 당일 정정).
function parseOptionalRate(raw, label) {
  return parseOptional(raw, label);
}

// 표시 단계에서만 반올림한다. 내부 계산은 반올림하지 않는다.
function formatKRW(v) {
  return Math.round(v).toLocaleString('ko-KR');
}
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
    VAT_RATE: VAT_RATE,
    LIMITS: LIMITS,
    monthlyStandardHours: monthlyStandardHours,
    rowCost: rowCost,
    estimate: estimate,
    parseField: parseField,
    parseRate: parseRate,
    parseOptional: parseOptional,
    parseOptionalRate: parseOptionalRate,
    formatKRW: formatKRW,
    formatMH: formatMH,
    formatMM: formatMM,
    formatMD: formatMD
  };
}
