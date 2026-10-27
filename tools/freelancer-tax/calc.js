// 프리랜서 종합소득세 환급 계산기 — 계산 로직 (확정 규칙: demand-check-freelancer-tax-1026.md, 2026-10-26)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.
// 전제: 사업소득(인적용역 3.3% 원천징수)만 있고 다른 소득이 없다.
//   필요경비 = 수입 × 경비율, 과세표준 = max(사업소득금액 − 150만 원 × 인원 − 추가 소득공제, 0)
//   산출세액 = 소득세법 제55조 누진세율 (원 미만 절사), 결정세액 = max(산출 − 표준세액공제 70,000, 0)
//   지방소득세 = 결정세액 × 10% (원 미만 절사), 기납부 = 수입 × 3% + 그 10%
//   정산 = 기납부 − 총 결정세액 (양수 환급, 음수 추가 납부)
(function () {
  'use strict';

  var BASIC_DEDUCTION_PER_PERSON = 1500000;
  var STANDARD_CREDIT = 70000; // 근로소득이 없는 종합소득자의 표준세액공제
  var MAX_INCOME = 10000000000;
  var MAX_RATE = 95;
  var MAX_DEPENDENTS = 20;
  // [상한, 세율, 누진공제] — 소득세법 제55조
  var BRACKETS = [
    [14000000, 0.06, 0],
    [50000000, 0.15, 1260000],
    [88000000, 0.24, 5760000],
    [150000000, 0.35, 15440000],
    [300000000, 0.38, 19940000],
    [500000000, 0.40, 25940000],
    [1000000000, 0.42, 35940000],
    [Infinity, 0.45, 65940000]
  ];

  function isValidIncome(v) {
    return typeof v === 'number' && isFinite(v) && v > 0 && v <= MAX_INCOME;
  }
  function isValidRate(v) {
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= MAX_RATE;
  }
  function isValidDependents(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 1 && v <= MAX_DEPENDENTS;
  }
  function isValidDeduction(v) {
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= MAX_INCOME;
  }

  function assessedTax(taxableBase) {
    if (typeof taxableBase !== 'number' || !isFinite(taxableBase) || taxableBase < 0) return null;
    for (var i = 0; i < BRACKETS.length; i++) {
      if (taxableBase <= BRACKETS[i][0]) {
        return Math.max(Math.floor(taxableBase * BRACKETS[i][1] - BRACKETS[i][2]), 0);
      }
    }
    return null;
  }

  // input: { income, expenseRate, dependents, extraDeduction }
  // expenseRate는 % (0~95, 소수 허용). extraDeduction은 null 허용 (0으로 본다). 금액은 원.
  function compute(input) {
    if (!input) return null;
    if (!isValidIncome(input.income)) return null;
    if (!isValidRate(input.expenseRate)) return null;
    if (!isValidDependents(input.dependents)) return null;
    var extra = (input.extraDeduction === null || input.extraDeduction === undefined) ? 0 : input.extraDeduction;
    if (!isValidDeduction(extra)) return null;

    var income = input.income;
    var expense = Math.round(income * input.expenseRate / 100);
    var businessIncome = income - expense;
    var basicDeduction = BASIC_DEDUCTION_PER_PERSON * input.dependents;
    var taxableBase = Math.max(businessIncome - basicDeduction - extra, 0);
    var assessed = assessedTax(taxableBase);
    var decided = Math.max(assessed - STANDARD_CREDIT, 0);
    var localTax = Math.floor(decided * 0.1);
    var totalTax = decided + localTax;
    var withheldIncome = Math.floor(income * 0.03);
    var withheldLocal = Math.floor(withheldIncome * 0.1);
    var withheld = withheldIncome + withheldLocal;
    var settlement = withheld - totalTax;

    return {
      income: income,      expenseRate: input.expenseRate,
      expense: expense,
      businessIncome: businessIncome,
      basicDeduction: basicDeduction,
      extraDeduction: extra,
      taxableBase: taxableBase,
      assessedTax: assessed,
      standardCredit: Math.min(STANDARD_CREDIT, assessed),
      decidedTax: decided,
      localTax: localTax,
      totalTax: totalTax,
      withheldIncome: withheldIncome,
      withheldLocal: withheldLocal,
      withheld: withheld,
      settlement: settlement,
      isRefund: settlement > 0,
      isPayment: settlement < 0,      effectiveRate: totalTax / income * 100
    };
  }

  // 실제 경비 금액으로 계산한다. 경비율로 환산해 compute와 같은 결과를 낸다.
  function computeWithExpenseAmount(input) {
    if (!input) return null;
    if (!isValidIncome(input.income)) return null;
    if (typeof input.expenseAmount !== 'number' || !isFinite(input.expenseAmount)
      || input.expenseAmount < 0 || input.expenseAmount > input.income) return null;
    var rate = input.expenseAmount / input.income * 100;
    var r = compute({
      income: input.income, expenseRate: rate,
      dependents: input.dependents, extraDeduction: input.extraDeduction
    });
    if (!r) return null;
    r.expense = input.expenseAmount;
    r.businessIncome = input.income - input.expenseAmount;
    // 경비 금액 기준 과세표준부터 다시 맞춘다 (반올림된 경비율 경유 오차 제거)
    var taxableBase = Math.max(r.businessIncome - r.basicDeduction - r.extraDeduction, 0);
    var assessed = assessedTax(taxableBase);
    var decided = Math.max(assessed - STANDARD_CREDIT, 0);
    var localTax = Math.floor(decided * 0.1);
    r.taxableBase = taxableBase;
    r.assessedTax = assessed;
    r.standardCredit = Math.min(STANDARD_CREDIT, assessed);
    r.decidedTax = decided;
    r.localTax = localTax;
    r.totalTax = decided + localTax;
    r.settlement = r.withheld - r.totalTax;
    r.isRefund = r.settlement > 0;
    r.isPayment = r.settlement < 0;
    r.effectiveRate = r.totalTax / input.income * 100;
    r.expenseRate = rate;
    return r;
  }

  // 손익분기 경비율: 정산 ≥ 0이 되는 최소 경비율을 0.1%p 단위로 올림해 돌려준다.
  // 0%에서 이미 환급이면 0, 95%에서도 납부면 null.
  function breakevenRate(input) {
    if (!input) return null;
    var base = { income: input.income, dependents: input.dependents, extraDeduction: input.extraDeduction };
    var at0 = compute({ income: base.income, expenseRate: 0, dependents: base.dependents, extraDeduction: base.extraDeduction });    if (!at0) return null;
    if (at0.settlement >= 0) return 0;
    var at95 = compute({ income: base.income, expenseRate: MAX_RATE, dependents: base.dependents, extraDeduction: base.extraDeduction });
    if (at95.settlement < 0) return null;
    var lo = 0, hi = MAX_RATE;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      var r = compute({ income: base.income, expenseRate: mid, dependents: base.dependents, extraDeduction: base.extraDeduction });
      if (r.settlement >= 0) { hi = mid; } else { lo = mid; }
    }
    return Math.ceil(hi * 10) / 10;
  }

  // 경비율 민감도: rates 배열의 각 경비율에 대한 정산 결과
  function sensitivity(input, rates) {
    if (!input || !Array.isArray(rates)) return null;
    var out = [];
    for (var i = 0; i < rates.length; i++) {
      var r = compute({
        income: input.income, expenseRate: rates[i],
        dependents: input.dependents, extraDeduction: input.extraDeduction
      });
      if (!r) return null;
      out.push({ rate: rates[i], expense: r.expense, totalTax: r.totalTax, settlement: r.settlement });    }
    return out;
  }

  var api = {
    BASIC_DEDUCTION_PER_PERSON: BASIC_DEDUCTION_PER_PERSON,
    STANDARD_CREDIT: STANDARD_CREDIT,
    MAX_RATE: MAX_RATE,
    BRACKETS: BRACKETS,
    assessedTax: assessedTax,
    compute: compute,
    computeWithExpenseAmount: computeWithExpenseAmount,
    breakevenRate: breakevenRate,
    sensitivity: sensitivity  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.FreelancerTaxCalc = api;
  }
})();
