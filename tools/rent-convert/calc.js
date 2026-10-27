// 전월세 전환 계산기 (제시 월세 상한 판정) — 계산 로직 (확정 규칙: demand-check-rent-convert-1027.md, 2026-10-27)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.
// 근거: 주택임대차보호법 제7조의2와 시행령 제9조 — 법정 상한율 = min(연 10%, 한국은행 기준금리 + 연 2%)
//   전환액 = 전세보증금 − 남길 보증금, 상한 월세 = floor(전환액 × 상한율 ÷ 12)
//   적용 전환율 = 제시 월세 × 12 ÷ 전환액 × 100, 초과액 = 제시 월세 − 상한 월세
(function () {
  'use strict';

  var STATUTORY_RATE = 10; // 시행령 제9조 제1호: 연 1할
  var BASE_PLUS = 2; // 시행령 제9조 제2호: 기준금리 + 연 2%
  var DEFAULT_BASE_RATE = 3.00; // 2026-08-27 인상, 2026-10-22 동결 확인 (2026-10-27)
  var MAX_AMOUNT = 100000000000; // 1,000억 원
  var MAX_MONTHS = 120;

  function isValidAmount(v) {
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= MAX_AMOUNT;
  }
  function isValidBaseRate(v) {
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 20;
  }
  function isValidMonths(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0 && v <= MAX_MONTHS;
  }

  // 법정 상한율 (%): min(10%, 기준금리 + 2%)
  function capRate(baseRate) {
    if (!isValidBaseRate(baseRate)) return null;
    return Math.min(STATUTORY_RATE, baseRate + BASE_PLUS);
  }

  // 상한 월세 (원 미만 절사)
  function capMonthly(converted, ratePct) {
    return Math.floor(converted * (ratePct / 100) / 12);
  }

  // input: { jeonse, keepDeposit, proposed, baseRate, monthsPaid }
  // 금액은 원, baseRate·율은 %. monthsPaid는 null 허용 (0으로 본다).
  function compute(input) {
    if (!input) return null;
    if (!isValidAmount(input.jeonse) || input.jeonse <= 0) return null;
    if (!isValidAmount(input.keepDeposit)) return null;
    if (input.keepDeposit > input.jeonse) return null;
    if (!isValidAmount(input.proposed) || input.proposed <= 0) return null;
    if (!isValidBaseRate(input.baseRate)) return null;
    var months = (input.monthsPaid === null || input.monthsPaid === undefined) ? 0 : input.monthsPaid;
    if (!isValidMonths(months)) return null;

    var converted = input.jeonse - input.keepDeposit;
    if (converted <= 0) return null;
    var cap = capRate(input.baseRate);
    var capM = capMonthly(converted, cap);
    var appliedRate = input.proposed * 12 / converted * 100;
    var excess = input.proposed - capM;
    var over = excess > 0;

    // 조정안 B: 제시 월세를 유지하면서 상한 이내가 되는 남길 보증금 (초과인 경우만)
    // 필요 최소 전환액 = 상한 월세가 제시 월세 이상이 되는 가장 작은 전환액.
    // floor(제시 월세 × 12 ÷ 상한율) 방식은 1원 부족한 전환액을 내놓을 수 있어
    // (GPT 독립 검증 2026-10-27, 사례 3·9에서 실증) ceil로 올린 뒤 상한 월세 식으로
    // 앞뒤를 확인해 확정한다. 필요 최소 전환액이 전세보증금을 넘으면 보증금을
    // 전부 전환해도 닿지 않으므로 조정 불가로 둔다 (같은 검증 사례 5).
    var requiredKeep = null;
    var keepChange = null;
    var planBFeasible = false;
    if (over) {
      var minConverted = Math.ceil(input.proposed * 12 / (cap / 100));
      while (capMonthly(minConverted, cap) < input.proposed) minConverted++;
      while (minConverted > 0 && capMonthly(minConverted - 1, cap) >= input.proposed) minConverted--;
      if (minConverted <= input.jeonse) {
        planBFeasible = true;
        requiredKeep = input.jeonse - minConverted;
        keepChange = requiredKeep - input.keepDeposit;
      }
    }    return {
      jeonse: input.jeonse,
      keepDeposit: input.keepDeposit,
      converted: converted,
      proposed: input.proposed,
      baseRate: input.baseRate,
      capRate: cap,
      capMonthly: capM,
      appliedRate: appliedRate,
      excess: excess,
      isOver: over,      isAtCap: excess === 0,
      margin: over ? 0 : -excess,
      excessYear: over ? excess * 12 : 0,
      excessTerm: over ? excess * 24 : 0,
      monthsPaid: months,
      paidExcess: over ? excess * months : 0,
      requiredKeep: requiredKeep,
      keepChange: keepChange,
      planBFeasible: planBFeasible
    };
  }

  // 보증금 조정표: 남길 보증금을 1,000만 원 단위 아래위 2단계씩 바꿀 때의 상한 월세
  function depositTable(input) {
    if (!input) return null;
    if (!isValidAmount(input.jeonse) || input.jeonse <= 0) return null;
    if (!isValidAmount(input.keepDeposit) || input.keepDeposit > input.jeonse) return null;    if (!isValidBaseRate(input.baseRate)) return null;
    var cap = capRate(input.baseRate);
    var step = 10000000;
    var offsets = [-2 * step, -step, 0, step, 2 * step];
    var seen = {};
    var rows = [];
    for (var i = 0; i < offsets.length; i++) {
      var keep = input.keepDeposit + offsets[i];
      if (keep < 0 || keep > input.jeonse) continue;
      if (seen[keep]) continue;
      seen[keep] = true;
      var converted = input.jeonse - keep;
      rows.push({        keepDeposit: keep,
        converted: converted,
        capMonthly: converted > 0 ? capMonthly(converted, cap) : 0,
        isCurrent: offsets[i] === 0      });
    }
    rows.sort(function (a, b) { return a.keepDeposit - b.keepDeposit; });
    return rows;
  }

  var api = {
    STATUTORY_RATE: STATUTORY_RATE,
    BASE_PLUS: BASE_PLUS,
    DEFAULT_BASE_RATE: DEFAULT_BASE_RATE,
    MAX_MONTHS: MAX_MONTHS,
    capRate: capRate,
    capMonthly: capMonthly,
    compute: compute,
    depositTable: depositTable
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;  }
  if (typeof window !== 'undefined') {
    window.RentConvertCalc = api;
  }})();
