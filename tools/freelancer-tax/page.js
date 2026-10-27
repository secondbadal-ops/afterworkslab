// 프리랜서 종합소득세 환급 계산기 — 화면 조작 (계산 자체는 calc.js)
(function () {
  'use strict';
  var C = window.FreelancerTaxCalc;
  var SENS_RATES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

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
  function fmtSettlement(v) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    if (v > 0) return '환급 ' + fmtWon(v);
    if (v < 0) return '추가 납부 ' + fmtWon(-v);
    return '정산 없음 (0원)';
  }
  function fmtRate(v) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    return (Math.round(v * 10) / 10).toLocaleString('ko-KR') + '%';
  }

  var els = {
    income: $('ft-income'), rate: $('ft-rate'), rateRange: $('ft-rate-range'),
    dependents: $('ft-dependents'), extra: $('ft-extra'),
    settlement: $('ft-settlement'), totalTax: $('ft-total-tax'),
    withheld: $('ft-withheld'), effective: $('ft-effective'),
    bExpense: $('ft-b-expense'), bBusiness: $('ft-b-business'),
    bBase: $('ft-b-base'), bAssessed: $('ft-b-assessed'),
    bDecided: $('ft-b-decided'), bTotal: $('ft-b-total'),
    beText: $('ft-be-text'), beAmount: $('ft-be-amount'),
    sensBody: $('ft-sens-body'),
    actual: $('ft-actual-amount'), aRate: $('ft-a-rate'),
    aSettlement: $('ft-a-settlement'), aDiff: $('ft-a-diff'),
    error: $('ft-error'), note: $('ft-note'),
    copyBtn: $('ft-copy-btn'), resetBtn: $('ft-reset-btn'),
    exampleBtn: $('ft-example-btn'), feedback: $('ft-feedback')
  };
  var last = null;
  var lastActual = null;

  function setError(msg) { els.error.textContent = msg || ''; }

  function readInputs() {
    var income = parseNum(els.income);
    var rate = parseNum(els.rate);
    var dep = parseNum(els.dependents);
    var extra = parseNum(els.extra);
    return {
      income: income, rate: rate, dependents: dep,
      extra: (extra === null || isNaN(extra)) ? 0 : extra,
      valid: income !== null && !isNaN(income) && rate !== null && !isNaN(rate)
        && dep !== null && !isNaN(dep) && !(extra !== null && isNaN(extra))
    };
  }

  function update() {
    els.feedback.textContent = '';
    var inp = readInputs();
    if (!inp.valid) {
      setError('연 수입, 경비율, 기본공제 인원을 넣어 주세요.');
      last = null;
      return;
    }
    var r = C.compute({
      income: inp.income, expenseRate: inp.rate,
      dependents: inp.dependents, extraDeduction: inp.extra
    });
    if (!r) {
      setError('입력값을 확인해 주세요. 경비율은 0~95%, 기본공제 인원은 1~20명까지 넣을 수 있습니다.');
      last = null;
      return;
    }
    setError('');
    last = r;
    els.settlement.textContent = fmtSettlement(r.settlement);
    els.totalTax.textContent = fmtWon(r.totalTax);    els.withheld.textContent = fmtWon(r.withheld);
    els.effective.textContent = (Math.round(r.effectiveRate * 100) / 100).toLocaleString('ko-KR') + '%';
    els.bExpense.textContent = fmtWon(r.expense) + ' (수입 × ' + fmtRate(r.expenseRate) + ')';
    els.bBusiness.textContent = fmtWon(r.businessIncome);
    els.bBase.textContent = fmtWon(r.taxableBase) + ' (기본공제 ' + fmtWon(r.basicDeduction) + (r.extraDeduction > 0 ? ' + 추가 공제 ' + fmtWon(r.extraDeduction) : '') + ' 차감)';
    els.bAssessed.textContent = fmtWon(r.assessedTax) + ' → 표준세액공제 ' + fmtWon(r.standardCredit) + ' 차감';
    els.bDecided.textContent = '국세 ' + fmtWon(r.decidedTax) + ' + 지방소득세 ' + fmtWon(r.localTax);
    els.bTotal.textContent = fmtWon(r.totalTax) + ' (이미 낸 3.3% ' + fmtWon(r.withheld) + '와 비교해 ' + fmtSettlement(r.settlement) + ')';
    els.note.textContent = r.isRefund
      ? '미리 낸 3.3%가 확정 세액보다 많습니다. 5월 종합소득세 신고를 해야 환급됩니다 — 신고하지 않으면 돌려받지 못합니다.'      : (r.isPayment
        ? '누진세율 때문에 확정 세액이 미리 낸 3.3%보다 많습니다. 경비율을 올리거나 실제 경비가 더 있는지 확인해 보세요.'
        : '미리 낸 금액과 확정 세액이 같습니다.');

    // 손익분기 경비율
    var be = C.breakevenRate({ income: inp.income, dependents: inp.dependents, extraDeduction: inp.extra });
    if (be === 0) {
      els.beText.textContent = '경비율 0%여도 환급입니다';
      els.beAmount.textContent = '경비를 하나도 인정받지 않아도 미리 낸 3.3%가 확정 세액보다 많습니다.';
    } else if (be === null) {
      els.beText.textContent = '경비율 95%까지 올려도 추가 납부입니다';
      els.beAmount.textContent = '이 수입에서는 경비율 조정만으로 환급이 되지 않습니다. 공제 항목을 늘리거나 장부(실제 경비)를 검토해 보세요.';
    } else {
      var beR = C.compute({ income: inp.income, expenseRate: be, dependents: inp.dependents, extraDeduction: inp.extra });
      els.beText.textContent = '경비율 ' + fmtRate(be) + '부터 환급입니다';
      els.beAmount.textContent = '필요경비 ' + fmtWon(beR.expense) + ' 이상이면 환급 구간입니다. 지금 경비율 ' + fmtRate(inp.rate) + '와 비교해 보세요.';
    }

    // 민감도 표
    var sens = C.sensitivity({ income: inp.income, dependents: inp.dependents, extraDeduction: inp.extra }, SENS_RATES);
    var html = '';
    for (var i = 0; i < sens.length; i++) {
      var s = sens[i];
      var mark = Math.abs(s.rate - inp.rate) < 5 ? ' class="total"' : '';
      html += '<tr' + mark + '><td>' + s.rate + '%</td><td>' + fmtWon(s.expense) + '</td><td>' + fmtWon(s.totalTax) + '</td><td>' + fmtSettlement(s.settlement) + '</td></tr>';
    }
    els.sensBody.innerHTML = html;

    // 실제 경비 대조
    var actualAmt = parseNum(els.actual);
    if (actualAmt === null || isNaN(actualAmt)) {
      lastActual = null;
      els.aRate.textContent = '실제 경비 금액을 넣으면 계산됩니다';
      els.aSettlement.textContent = '-';
      els.aDiff.textContent = '-';
    } else {
      var a = C.computeWithExpenseAmount({
        income: inp.income, expenseAmount: actualAmt,
        dependents: inp.dependents, extraDeduction: inp.extra
      });
      if (!a) {
        lastActual = null;
        els.aRate.textContent = '실제 경비는 수입 이하의 금액으로 넣어 주세요.';
        els.aSettlement.textContent = '-';
        els.aDiff.textContent = '-';
      } else {
        lastActual = a;
        els.aRate.textContent = fmtRate(a.expenseRate) + ' (경비 ' + fmtWon(a.expense) + ')';
        els.aSettlement.textContent = fmtSettlement(a.settlement);        var diff = a.settlement - r.settlement;
        els.aDiff.textContent = diff === 0
          ? '경비율 방식과 같습니다'
          : (diff > 0
            ? '실제 경비 방식이 ' + fmtWon(diff) + ' 유리합니다'            : '경비율 방식이 ' + fmtWon(-diff) + ' 유리합니다');
      }
    }
  }

  function formatField(el) {
    var v = parseNum(el);
    if (v !== null && isFinite(v)) el.value = v.toLocaleString('ko-KR');
  }

  ['input', 'change'].forEach(function (ev) {
    [els.income, els.rate, els.dependents, els.extra, els.actual].forEach(function (el) {
      el.addEventListener(ev, update);
    });
    els.rateRange.addEventListener(ev, function () {
      els.rate.value = els.rateRange.value;
      update();
    });
    els.rate.addEventListener(ev, function () {
      var v = parseNum(els.rate);
      if (v !== null && isFinite(v) && v >= 0 && v <= 90) els.rateRange.value = String(Math.round(v));
    });
  });
  [els.income, els.extra, els.actual].forEach(function (el) {
    el.addEventListener('change', function () { formatField(el); });
  });

  els.exampleBtn.addEventListener('click', function () {
    els.income.value = '36,000,000';
    els.rate.value = '50';
    els.rateRange.value = '50';
    els.dependents.value = '1';
    els.extra.value = '';
    els.actual.value = '21,600,000';
    update();
  });
  els.resetBtn.addEventListener('click', function () {
    els.income.value = '36,000,000';
    els.rate.value = '60';
    els.rateRange.value = '60';
    els.dependents.value = '1';
    els.extra.value = '';
    els.actual.value = '';
    update();
  });
  els.copyBtn.addEventListener('click', function () {    if (!last) { els.feedback.textContent = '먼저 계산 결과가 있어야 복사할 수 있습니다.'; return; }
    var text = '프리랜서 종합소득세 정산 추정 (Afterwork Lab 프리랜서 종합소득세 환급 계산기)\n'
      + '연 수입: ' + fmtWon(last.income) + ' · 경비율 ' + fmtRate(last.expenseRate) + '\n'
      + '확정 세액(지방세 포함): ' + fmtWon(last.totalTax) + '\n'
      + '이미 낸 3.3%: ' + fmtWon(last.withheld) + '\n'
      + '정산: ' + fmtSettlement(last.settlement);
    if (lastActual) {
      text += '\n실제 경비 ' + fmtWon(lastActual.expense) + ' 기준 정산: ' + fmtSettlement(lastActual.settlement);
    }    function done() { els.feedback.textContent = '결과를 복사했습니다.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { els.feedback.textContent = '복사에 실패했습니다.'; });
    } else {
      els.feedback.textContent = '이 브라우저에서는 복사를 지원하지 않습니다.';
    }
  });

  update();
})();
