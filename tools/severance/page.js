// 퇴직금 계산기 — 화면 조작 (계산 자체는 calc.js)
(function () {
  'use strict';
  var C = window.SeveranceCalc;

  function $(id) { return document.getElementById(id); }
  function parseMoney(el) {
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
  function fmtNum(v) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    return v.toLocaleString('ko-KR');
  }

  var els = {
    hire: $('sev-hire'), last: $('sev-last'),
    monthly: $('sev-monthly'), wage3m: $('sev-wage3m'),
    bonus: $('sev-bonus'), leavePrior: $('sev-leave-prior'),
    ordinary: $('sev-ordinary'), unused: $('sev-unused'),
    weekly: $('sev-weekly'),
    total: $('sev-total'), severance: $('sev-severance'),
    daily: $('sev-daily'), service: $('sev-service'),
    leaveAllow: $('sev-leave-allow'),
    bPeriod: $('sev-b-period'), bWage: $('sev-b-wage'),
    bBasis: $('sev-b-basis'), bFormula: $('sev-b-formula'),
    note: $('sev-note'), error: $('sev-error'),
    copyBtn: $('sev-copy-btn'), resetBtn: $('sev-reset-btn'),
    exampleBtn: $('sev-example-btn'), feedback: $('sev-feedback')
  };
  var lastResult = null;

  function setError(msg) { els.error.textContent = msg || ''; }

  function update() {
    els.feedback.textContent = '';
    var hire = els.hire.value;
    var last = els.last.value;
    var wage3m = parseMoney(els.wage3m);
    if (!hire || !last) { setError('입사일과 마지막 근무일을 넣어 주세요.'); lastResult = null; return; }
    if (wage3m === null || isNaN(wage3m)) { setError('퇴직 전 3개월 임금 총액(또는 월급)을 넣어 주세요.'); lastResult = null; return; }
    var unusedRaw = String(els.unused.value).trim();
    var unused = unusedRaw === '' ? null : Number(unusedRaw);
    if (unused !== null && !isFinite(unused)) { setError('미사용 연차일수를 숫자로 넣어 주세요.'); lastResult = null; return; }
    var r = C.compute({
      hire: hire, last: last, wage3m: wage3m,
      annualBonus: parseMoney(els.bonus) || 0,
      annualLeavePrior: parseMoney(els.leavePrior) || 0,
      monthlyOrdinary: parseMoney(els.ordinary),
      unusedLeaveDays: unused,
      weeklyHoursOk: els.weekly.checked
    });
    if (!r) { setError('날짜나 금액을 확인해 주세요. 마지막 근무일이 입사일보다 빠를 수는 없습니다.'); lastResult = null; return; }
    setError('');
    lastResult = r;
    els.total.textContent = fmtWon(r.totalPayout);
    els.severance.textContent = fmtWon(r.severance);
    els.daily.textContent = fmtWon(r.appliedDaily);
    var years = Math.floor(r.serviceDays / 365);
    var rem = r.serviceDays - years * 365;
    els.service.textContent = fmtNum(r.serviceDays) + '일 (' + years + '년 ' + rem + '일)';
    els.leaveAllow.textContent = r.leaveAllowance !== null ? fmtWon(r.leaveAllowance)
      : (r.leaveNeedsOrdinary ? '월 통상임금을 넣으면 계산됩니다' : '-');
    els.bPeriod.textContent = r.periodStart + ' ~ ' + r.periodEnd + ' (' + r.periodDays + '일), 퇴직일 ' + r.retirementDate;
    els.bWage.textContent = fmtWon(r.wageForAvg) + ' ÷ ' + r.periodDays + '일 = 1일 평균임금 ' + fmtWon(r.dailyAvg);
    els.bBasis.textContent = r.appliedBasis === 'ordinary'
      ? '1일 통상임금 ' + fmtWon(r.dailyOrd) + '이 평균임금보다 커서 통상임금을 적용했습니다.'
      : (r.dailyOrd !== null ? '1일 평균임금이 통상임금(' + fmtWon(r.dailyOrd) + ')보다 커서 평균임금을 적용했습니다.' : '월 통상임금을 넣지 않아 평균임금만으로 계산했습니다.');
    els.bFormula.textContent = fmtWon(r.appliedDaily) + ' × 30 × ' + fmtNum(r.serviceDays) + '일 ÷ 365 = ' + fmtWon(r.severance);
    if (!r.eligible) {
      els.note.textContent = r.serviceDays < 365
        ? '계속근로기간이 1년(365일)에 못 미쳐 법정 퇴직금은 0원입니다. 회사 규정이 별도로 정한 경우는 다를 수 있습니다.'
        : '4주 평균 주 15시간 미만이면 퇴직급여 대상에서 제외됩니다.';
    } else if (r.leaveNeedsOrdinary) {
      els.note.textContent = '미사용 연차수당을 합산하려면 월 통상임금(기본급+고정수당)을 넣어 주세요. 연차수당은 평균임금에 넣지 않고 따로 더합니다.';
    } else {
      els.note.textContent = '세전 금액입니다. 퇴직소득세는 근속연수와 금액에 따라 달라져 이 계산기에서는 빼지 않았습니다.';
    }
  }

  function formatMoneyField(el) {
    var v = parseMoney(el);
    if (v !== null && isFinite(v)) el.value = v.toLocaleString('ko-KR');
  }

  ['input', 'change'].forEach(function (ev) {
    [els.hire, els.last, els.bonus, els.leavePrior, els.ordinary, els.unused].forEach(function (el) {
      el.addEventListener(ev, update);
    });
    els.weekly.addEventListener(ev, update);
  });
  els.monthly.addEventListener('input', function () {
    var m = parseMoney(els.monthly);
    if (m !== null && isFinite(m)) els.wage3m.value = (m * 3).toLocaleString('ko-KR');
    update();
  });
  els.wage3m.addEventListener('input', function () {
    els.monthly.value = '';
    update();
  });
  [els.monthly, els.wage3m, els.bonus, els.leavePrior, els.ordinary].forEach(function (el) {
    el.addEventListener('change', function () { formatMoneyField(el); });
  });

  els.exampleBtn.addEventListener('click', function () {
    els.hire.value = '2021-10-01';
    els.last.value = '2026-09-30';
    els.monthly.value = '';
    els.wage3m.value = '12,600,000';
    els.bonus.value = '6,000,000';
    els.leavePrior.value = '600,000';
    els.ordinary.value = '4,000,000';
    els.unused.value = '';
    els.weekly.checked = true;
    update();
  });
  els.resetBtn.addEventListener('click', function () {
    [els.monthly, els.wage3m, els.bonus, els.leavePrior, els.ordinary, els.unused].forEach(function (el) { el.value = ''; });
    els.hire.value = ''; els.last.value = ''; els.weekly.checked = true;
    update();
  });
  els.copyBtn.addEventListener('click', function () {
    if (!lastResult) { els.feedback.textContent = '먼저 계산 결과가 있어야 복사할 수 있습니다.'; return; }
    var text = '퇴직 정산 (Afterwork Lab 퇴직금 계산기)\n'
      + '재직일수: ' + lastResult.serviceDays + '일 (퇴직일 ' + lastResult.retirementDate + ')\n'
      + '적용 1일 임금: ' + fmtWon(lastResult.appliedDaily) + '\n'
      + '세전 퇴직금: ' + fmtWon(lastResult.severance) + '\n'
      + '미사용 연차수당: ' + (lastResult.leaveAllowance !== null ? fmtWon(lastResult.leaveAllowance) : '미계산') + '\n'
      + '총 정산액(세전): ' + fmtWon(lastResult.totalPayout);
    function done() { els.feedback.textContent = '결과를 복사했습니다.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { els.feedback.textContent = '복사에 실패했습니다.'; });
    } else {
      els.feedback.textContent = '이 브라우저에서는 복사를 지원하지 않습니다.';
    }
  });

  update();
})();
