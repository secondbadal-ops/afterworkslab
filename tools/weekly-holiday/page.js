// 주휴수당 계산기 — 화면 조작 (계산 자체는 calc.js)
(function () {
  'use strict';
  var C = window.WeeklyHolidayCalc;

  function $(id) { return document.getElementById(id); }
  function parseNum(el) {
    if (!el) return null;
    var raw = String(el.value).replace(/,/g, '').trim();
    if (raw === '') return null;
    var v = Number(raw);
    return isFinite(v) ? v : NaN;
  }
  function fmtWon(v) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    return Math.round(v).toLocaleString('ko-KR') + '원';
  }
  function fmtHours(v) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    return (Math.round(v * 100) / 100).toLocaleString('ko-KR') + '시간';
  }

  var els = {
    wage: $('wh-wage'), hours: $('wh-hours'), attended: $('wh-attended'),
    weeklyPay: $('wh-weekly-pay'), holidayPay: $('wh-holiday-pay'),
    holidayHours: $('wh-holiday-hours'), monthlyPay: $('wh-monthly-pay'),
    bBase: $('wh-b-base'), bFormula: $('wh-b-formula'),
    bMonth: $('wh-b-month'), bElig: $('wh-b-elig'),
    incWage: $('wh-inc-wage'), incHours: $('wh-inc-hours'), incYear: $('wh-inc-year'),
    incBase: $('wh-inc-base'), incVerdict: $('wh-inc-verdict'),
    incRequired: $('wh-inc-required'), incDetail: $('wh-inc-detail'),
    actual: $('wh-actual-pay'), weeks: $('wh-weeks'),
    cShortfall: $('wh-c-shortfall'), cCumulative: $('wh-c-cumulative'),
    cUnpaid: $('wh-c-unpaid'), cNote: $('wh-c-note'),
    note: $('wh-note'), error: $('wh-error'),
    copyBtn: $('wh-copy-btn'), resetBtn: $('wh-reset-btn'),
    exampleBtn: $('wh-example-btn'), feedback: $('wh-feedback')
  };
  var lastCore = null;
  var lastInc = null;

  function setError(msg) { els.error.textContent = msg || ''; }

  function updateCore() {
    els.feedback.textContent = '';
    var wage = parseNum(els.wage);
    var hours = parseNum(els.hours);
    var actual = parseNum(els.actual);
    var weeksRaw = String(els.weeks.value).trim();
    var weeks = weeksRaw === '' ? null : Number(weeksRaw);
    if (weeks !== null && !isFinite(weeks)) weeks = NaN;
    if (wage === null || isNaN(wage) || hours === null || isNaN(hours)) {
      setError('시급과 주 소정근로시간을 넣어 주세요.');
      lastCore = null;
      return;
    }
    var r = C.compute({
      hourlyWage: wage, weeklyHours: hours, attendedAll: els.attended.checked,
      actualWeeklyPay: (actual === null || isNaN(actual)) ? null : actual,
      weeksWorked: weeks
    });
    if (!r) { setError('입력값을 확인해 주세요. 주 소정근로시간은 80시간까지, 근무 주 수는 520주까지 넣을 수 있습니다.'); lastCore = null; return; }
    setError('');
    lastCore = r;
    els.weeklyPay.textContent = fmtWon(r.expectedWeeklyPay);
    els.holidayPay.textContent = fmtWon(r.weeklyHolidayPay);
    els.holidayHours.textContent = fmtHours(r.holidayHours);
    els.monthlyPay.textContent = fmtWon(r.monthlyPay);
    els.bBase.textContent = fmtWon(r.weeklyBasePay) + ' (주 ' + hours + '시간 × ' + fmtWon(wage) + ')';
    els.bFormula.textContent = r.eligible
      ? '주휴시간 ' + fmtHours(r.holidayHours) + ' × ' + fmtWon(wage) + ' = ' + fmtWon(r.weeklyHolidayPay)
      : '주휴시간 0시간 — 주휴수당이 발생하지 않습니다';
    els.bMonth.textContent = '월 유급 ' + r.monthlyPaidHours + '시간 (근로 ' + r.monthlyWorkHours + ' + 주휴 ' + r.monthlyHolidayHours + ') = ' + fmtWon(r.monthlyPay) + ' · 그중 주휴수당 월 ' + fmtWon(r.monthlyHolidayPay);
    els.bElig.textContent = r.eligible
      ? '대상입니다 — 4주 평균 주 15시간 이상이고 개근한 주입니다.'
      : (r.ineligibleReason === 'hours'
        ? '대상이 아닙니다 — 4주 평균 주 소정근로시간이 15시간 미만이면 주휴수당이 발생하지 않습니다.'
        : '이 주는 대상이 아닙니다 — 소정근로일을 개근하지 못한 주의 주휴수당은 발생하지 않습니다.');
    els.note.textContent = r.eligible
      ? '세전 금액입니다. 연장·야간·휴일 가산수당과 4대보험·세금 공제는 넣지 않았습니다.'
      : '주마다 근무시간이 다르면 4주 평균 주 소정근로시간으로 판단합니다. 계약서에 적힌 소정근로시간이 기준입니다.';
    // 실지급 대조
    els.cShortfall.textContent = r.weeklyShortfall !== null ? fmtWon(r.weeklyShortfall) : '실제 받은 주급을 넣으면 계산됩니다';
    els.cCumulative.textContent = r.cumulativeShortfall !== null ? fmtWon(r.cumulativeShortfall) : '-';
    els.cUnpaid.textContent = r.unpaidHolidayTotal !== null ? fmtWon(r.unpaidHolidayTotal) : '-';
    if (r.overLimitation) {
      els.cNote.textContent = '근무 주 수가 156주(3년)를 넘습니다. 임금채권 소멸시효가 3년이라 그보다 오래된 미지급분은 청구가 어려울 수 있으니, 누적액은 최근 156주 기준으로 다시 확인해 보세요.';
    } else if (r.weeklyShortfall !== null && r.weeklyShortfall > 0) {
      els.cNote.textContent = '기대 주급보다 적게 받은 것으로 계산됩니다. 급여명세서에 주휴수당 항목이 있는지, 시급에 포함된 계약인지부터 확인하세요.';
    } else if (r.weeklyShortfall === 0) {
      els.cNote.textContent = '입력한 실수령 주급이 기대 주급과 같습니다.';
    } else {
      els.cNote.textContent = '누적 추정은 같은 조건으로 매주 개근했고 매주 같은 차액이 이어졌다는 가정의 단순 계산입니다.';
    }
  }

  function updateIncluded() {
    var inc = parseNum(els.incWage);
    var incHours = parseNum(els.incHours);
    if (inc === null || isNaN(inc) || incHours === null || isNaN(incHours)) {
      lastInc = null;
      els.incBase.textContent = '-';
      els.incVerdict.textContent = '포함 시급과 그 일자리의 주 소정근로시간을 넣으면 판정합니다';
      els.incRequired.textContent = '-';
      els.incDetail.textContent = '-';
      return;
    }
    var v = C.verifyIncluded({ includedWage: inc, weeklyHours: incHours, year: Number(els.incYear.value) });
    if (!v) { lastInc = null; els.incVerdict.textContent = '입력값을 확인해 주세요.'; return; }
    lastInc = v;
    els.incBase.textContent = fmtWon(v.baseWage);
    els.incVerdict.textContent = !v.hasHoliday
      ? '주 15시간 미만이라 주휴수당이 없습니다. 포함 시급이 곧 기본시급이며, ' + (v.pass ? '최저시급 이상입니다.' : '최저시급에 미달합니다.')
      : (v.pass
        ? '지킵니다 — 기본시급으로 나눠도 최저시급 ' + fmtWon(v.minWage) + ' 이상입니다.'
        : '미달입니다 — 기본시급으로 나누면 최저시급 ' + fmtWon(v.minWage) + '에 못 미칩니다.');
    els.incRequired.textContent = fmtWon(v.requiredIncluded) + ' 이상';
    els.incDetail.textContent = '한 주 총액 ' + fmtWon(v.weeklyTotal) + ' = 기본급 ' + fmtWon(v.basePart) + ' + 주휴분 ' + fmtWon(v.holidayPart) + ' (주휴시간 ' + fmtHours(v.holidayHours) + ', 개근 전제)';
  }

  function update() { updateCore(); updateIncluded(); }

  function formatField(el) {
    var v = parseNum(el);
    if (v !== null && isFinite(v)) el.value = v.toLocaleString('ko-KR');
  }

  ['input', 'change'].forEach(function (ev) {
    [els.wage, els.hours, els.actual, els.weeks, els.incWage, els.incHours].forEach(function (el) {
      el.addEventListener(ev, update);
    });
    els.attended.addEventListener(ev, update);
    els.incYear.addEventListener(ev, update);
  });
  [els.wage, els.actual, els.incWage].forEach(function (el) {
    el.addEventListener('change', function () { formatField(el); });
  });

  els.exampleBtn.addEventListener('click', function () {
    els.wage.value = '10,320';
    els.hours.value = '20';
    els.attended.checked = true;
    els.actual.value = '206,400';
    els.weeks.value = '52';
    els.incWage.value = '12,000';
    els.incHours.value = '20';
    els.incYear.value = '2026';
    update();
  });
  els.resetBtn.addEventListener('click', function () {
    els.wage.value = '10,320';
    els.hours.value = '40';
    els.attended.checked = true;
    els.actual.value = ''; els.weeks.value = '';
    els.incWage.value = ''; els.incHours.value = ''; els.incYear.value = '2026';
    update();
  });
  els.copyBtn.addEventListener('click', function () {
    if (!lastCore) { els.feedback.textContent = '먼저 계산 결과가 있어야 복사할 수 있습니다.'; return; }
    var text = '주휴수당 계산 (Afterwork Lab 주휴수당 계산기)\n'
      + '주휴시간: ' + fmtHours(lastCore.holidayHours) + '\n'
      + '1주 주휴수당: ' + fmtWon(lastCore.weeklyHolidayPay) + '\n'
      + '기대 주급(세전): ' + fmtWon(lastCore.expectedWeeklyPay) + '\n'
      + '월급 환산(세전): ' + fmtWon(lastCore.monthlyPay);
    if (lastCore.weeklyShortfall !== null) {
      text += '\n주 차액(기대-실수령): ' + fmtWon(lastCore.weeklyShortfall);
    }
    if (lastCore.cumulativeShortfall !== null) {
      text += '\n누적 차액 추정: ' + fmtWon(lastCore.cumulativeShortfall);
    }
    if (lastInc) {
      text += '\n포함 시급 검증: 기본시급 ' + fmtWon(lastInc.baseWage) + ' — ' + (lastInc.pass ? '최저시급 이상' : '최저시급 미달');
    }
    function done() { els.feedback.textContent = '결과를 복사했습니다.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { els.feedback.textContent = '복사에 실패했습니다.'; });
    } else {
      els.feedback.textContent = '이 브라우저에서는 복사를 지원하지 않습니다.';
    }
  });

  update();
})();
