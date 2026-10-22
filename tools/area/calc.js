// 평·㎡ 면적 변환기 — 계산 로직 (확정 규칙: demand-check-area-1022.md, 2026-10-22)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.
// 확정 공식: 1평 = 400/121㎡ (약 3.305785㎡), 1㎡ = 121/400평 (정확히 0.3025평)
(function () {
  'use strict';

  var SQM_PER_PYEONG = 400 / 121;      // 약 3.305785123966942
  var PYEONG_PER_SQM = 121 / 400;      // 정확히 0.3025
  var SQFT_PER_SQM = 10.7639;
  var MAX_AREA = 1000000;              // ㎡·평 공통 입력 상한

  function isValidArea(v) {
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= MAX_AREA;
  }
  function round2(v) { return Math.round(v * 100) / 100; }
  function round1(v) { return Math.round(v * 10) / 10; }

  function pyeongToSqm(p) {
    if (!isValidArea(p)) return null;
    return p * SQM_PER_PYEONG;
  }
  function sqmToPyeong(s) {
    if (!isValidArea(s)) return null;
    return s * PYEONG_PER_SQM;
  }
  function sqmToSqft(s) {
    if (!isValidArea(s)) return null;
    return s * SQFT_PER_SQM;
  }
  // 정사각형으로 봤을 때 한 변 (m)
  function squareSideM(sqm) {
    if (!isValidArea(sqm)) return null;
    return Math.sqrt(sqm);
  }
  // 가로·세로 (m) -> 면적
  function rectArea(widthM, heightM) {
    if (!isValidArea(widthM) || !isValidArea(heightM)) return null;
    var sqm = widthM * heightM;
    if (sqm > MAX_AREA) return null;
    return { sqm: sqm, pyeong: sqm * PYEONG_PER_SQM, sqft: sqm * SQFT_PER_SQM };
  }
  // 전용률 (%) = 전용 / 공급 * 100. 둘 다 양수여야 한다.
  function exclusiveRate(exclusiveSqm, supplySqm) {
    if (!isValidArea(exclusiveSqm) || !isValidArea(supplySqm)) return null;
    if (exclusiveSqm <= 0 || supplySqm <= 0) return null;
    if (exclusiveSqm > supplySqm) return null;
    return exclusiveSqm / supplySqm * 100;
  }
  // 전용면적 + 전용률(%) -> 공급면적 추정. 전용률은 1~100 사이.
  function estimateSupply(exclusiveSqm, ratePct) {
    if (!isValidArea(exclusiveSqm) || exclusiveSqm <= 0) return null;
    if (typeof ratePct !== 'number' || !isFinite(ratePct) || ratePct < 1 || ratePct > 100) return null;
    return exclusiveSqm / (ratePct / 100);
  }
  // 가격(만원) 기준 단가. 반환은 만원 단위 그대로.
  function pricePer(priceManwon, sqm) {
    if (typeof priceManwon !== 'number' || !isFinite(priceManwon) || priceManwon <= 0) return null;
    if (!isValidArea(sqm) || sqm <= 0) return null;
    var pyeong = sqm * PYEONG_PER_SQM;
    return { perPyeong: priceManwon / pyeong, perSqm: priceManwon / sqm, pyeong: pyeong };
  }

  // 아파트 대표 전용면적. supplyAt75는 전용률 75%로 가정한 공급 추정(대략)이며,
  // commonLabel은 복수 출처가 일치하는 관행 표기(대략)다.
  var APARTMENT_PRESETS = [
    { exclusiveSqm: 39, commonLabel: '16~17평형' },
    { exclusiveSqm: 49, commonLabel: '20~21평형' },
    { exclusiveSqm: 59, commonLabel: '24~26평형' },
    { exclusiveSqm: 74, commonLabel: '29~31평형' },
    { exclusiveSqm: 84, commonLabel: '33~35평형' },
    { exclusiveSqm: 101, commonLabel: '40~42평형' },
    { exclusiveSqm: 114, commonLabel: '44~46평형' },
    { exclusiveSqm: 135, commonLabel: '51~54평형' }
  ];

  var api = {
    SQM_PER_PYEONG: SQM_PER_PYEONG,
    PYEONG_PER_SQM: PYEONG_PER_SQM,
    SQFT_PER_SQM: SQFT_PER_SQM,
    MAX_AREA: MAX_AREA,
    isValidArea: isValidArea,
    round2: round2,
    round1: round1,
    pyeongToSqm: pyeongToSqm,
    sqmToPyeong: sqmToPyeong,
    sqmToSqft: sqmToSqft,
    squareSideM: squareSideM,
    rectArea: rectArea,
    exclusiveRate: exclusiveRate,
    estimateSupply: estimateSupply,
    pricePer: pricePer,
    APARTMENT_PRESETS: APARTMENT_PRESETS
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.AreaCalc = api;
  }
})();
