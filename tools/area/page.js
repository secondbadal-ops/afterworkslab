// 평·㎡ 면적 변환기 — 화면 조작 (계산 자체는 calc.js)
(function () {
  'use strict';
  var C = window.AreaCalc;

  function $(id) { return document.getElementById(id); }
  function parseNum(el) {
    if (!el) return null;
    var raw = String(el.value).replace(/,/g, '').trim();
    if (raw === '') return null;
    var v = Number(raw);
    return isFinite(v) ? v : NaN;
  }
  function fmt(v, digits) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    return v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function fmtTrim(v) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    return v.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  var pyInput = $('py-input'), sqmInput = $('sqm-input');
  var elPy = $('result-pyeong'), elSqm = $('result-sqm'), elSqft = $('result-sqft'), elSide = $('result-side');
  var elError = $('area-error'), elFeedback = $('copy-feedback');

  function setMain(sqm, sourceEl) {
    if (sqm === null || isNaN(sqm)) {
      elPy.textContent = '-'; elSqm.textContent = '-'; elSqft.textContent = '-'; elSide.textContent = '-';
      return;
    }
    elPy.textContent = fmt(C.sqmToPyeong(sqm), 2);
    elSqm.textContent = fmt(sqm, 2);
    elSqft.textContent = fmt(C.sqmToSqft(sqm), 1);
    elSide.textContent = fmt(C.squareSideM(sqm), 2);
    if (sourceEl !== pyInput) pyInput.value = fmtTrim(C.sqmToPyeong(sqm));
    if (sourceEl !== sqmInput) sqmInput.value = fmtTrim(sqm);
  }
  function onMainInput(sourceEl) {
    elError.textContent = '';
    var v = parseNum(sourceEl);
    if (v === null) { setMain(null); return; }
    if (isNaN(v) || v < 0) { elError.textContent = '0 이상의 숫자를 입력해 주세요.'; setMain(null); return; }
    if (v > C.MAX_AREA) { elError.textContent = '입력 상한은 1,000,000까지입니다.'; setMain(null); return; }
    var sqm = sourceEl === pyInput ? C.pyeongToSqm(v) : v;
    setMain(sqm, sourceEl);
  }
  pyInput.addEventListener('input', function () { onMainInput(pyInput); });
  sqmInput.addEventListener('input', function () { onMainInput(sqmInput); });

  // 대표 전용면적 칩
  var chips = document.querySelectorAll('.apt-chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener('click', function () {
      var sqm = Number(this.getAttribute('data-sqm'));
      sqmInput.value = String(sqm);
      onMainInput(sqmInput);
      var ex = $('apt-ex-input');
      ex.value = String(sqm);
      onAptInput();
      sqmInput.focus();
    });
  }

  // 가로·세로
  var rectW = $('rect-w'), rectH = $('rect-h');
  function onRect() {
    var w = parseNum(rectW), h = parseNum(rectH);
    var out = { sqm: $('rect-sqm'), pyeong: $('rect-pyeong'), sqft: $('rect-sqft') };
    if (w === null || h === null || isNaN(w) || isNaN(h) || w < 0 || h < 0) {
      out.sqm.textContent = '-'; out.pyeong.textContent = '-'; out.sqft.textContent = '-'; return;
    }
    var r = C.rectArea(w, h);
    if (!r) { out.sqm.textContent = '-'; out.pyeong.textContent = '-'; out.sqft.textContent = '-'; return; }
    out.sqm.textContent = fmt(r.sqm, 2); out.pyeong.textContent = fmt(r.pyeong, 2); out.sqft.textContent = fmt(r.sqft, 1);
  }
  rectW.addEventListener('input', onRect);
  rectH.addEventListener('input', onRect);

  // 아파트: 전용·공급·전용률 + 추정 + 평당가
  var aptEx = $('apt-ex-input'), aptSup = $('apt-sup-input'), priceInput = $('price-input');
  function onAptInput() {
    var ex = parseNum(aptEx), sup = parseNum(aptSup);
    var rateEl = $('apt-rate'), commonEl = $('apt-common'), exPyEl = $('apt-ex-pyeong'), supPyEl = $('apt-sup-pyeong');
    var validEx = ex !== null && !isNaN(ex) && ex > 0 && ex <= C.MAX_AREA;
    exPyEl.textContent = validEx ? fmt(C.sqmToPyeong(ex), 2) : '-';
    var validSup = sup !== null && !isNaN(sup) && sup > 0 && sup <= C.MAX_AREA;
    supPyEl.textContent = validSup ? fmt(C.sqmToPyeong(sup), 2) : '-';
    if (validEx && validSup) {
      var rate = C.exclusiveRate(ex, sup);
      rateEl.textContent = rate === null ? '전용이 공급보다 큽니다' : fmt(rate, 1) + '%';
      commonEl.textContent = sup > ex ? fmt(sup - ex, 2) + '㎡' : '-';
    } else {
      rateEl.textContent = '-'; commonEl.textContent = '-';
    }
    // 전용률 시나리오별 공급 추정 (전용만 알 때)
    [70, 75, 80].forEach(function (r) {
      var cell = $('est-sup-' + r), pyCell = $('est-pyeong-' + r);
      if (!cell) return;
      if (!validEx) { cell.textContent = '-'; if (pyCell) pyCell.textContent = '-'; return; }
      var est = C.estimateSupply(ex, r);
      cell.textContent = fmt(est, 1);
      if (pyCell) pyCell.textContent = fmt(C.sqmToPyeong(est), 1);
    });
    // 평당가: 같은 가격을 전용 기준·공급 기준으로 나란히
    var price = parseNum(priceInput);
    var perEx = $('price-per-ex'), perSup = $('price-per-sup');
    if (price !== null && !isNaN(price) && price > 0) {
      var pe = validEx ? C.pricePer(price, ex) : null;
      var ps = validSup ? C.pricePer(price, sup) : null;
      perEx.textContent = pe ? fmt(Math.round(pe.perPyeong), 0) + '만 원' : '-';
      perSup.textContent = ps ? fmt(Math.round(ps.perPyeong), 0) + '만 원' : '-';
    } else {
      perEx.textContent = '-'; perSup.textContent = '-';
    }
  }
  aptEx.addEventListener('input', onAptInput);
  aptSup.addEventListener('input', onAptInput);
  priceInput.addEventListener('input', onAptInput);

  $('example-btn').addEventListener('click', function () {
    sqmInput.value = '84'; onMainInput(sqmInput);
    rectW.value = '5.2'; rectH.value = '3.4'; onRect();
    aptEx.value = '84'; aptSup.value = '112.4'; priceInput.value = '120000'; onAptInput();
    elFeedback.textContent = '전용 84㎡ 예시를 넣었습니다.';
  });
  $('reset-btn').addEventListener('click', function () {
    [pyInput, sqmInput, rectW, rectH, aptEx, aptSup, priceInput].forEach(function (el) { el.value = ''; });
    elError.textContent = ''; elFeedback.textContent = '';
    setMain(null); onRect(); onAptInput();
    sqmInput.focus();
  });
  $('copy-btn').addEventListener('click', function () {
    var sqm = parseNum(sqmInput);
    if (sqm === null || isNaN(sqm)) { elFeedback.textContent = '먼저 면적을 입력해 주세요.'; return; }
    var text = fmt(sqm, 2) + '㎡ = ' + fmt(C.sqmToPyeong(sqm), 2) + '평 (1평 = 3.3058㎡, Afterwork Lab 평수 계산기)';
    var ex = parseNum(aptEx), sup = parseNum(aptSup);
    if (ex !== null && !isNaN(ex) && ex > 0 && sup !== null && !isNaN(sup) && sup > 0) {
      var rate = C.exclusiveRate(ex, sup);
      if (rate !== null) text += ' / 전용 ' + fmt(ex, 1) + '㎡·공급 ' + fmt(sup, 1) + '㎡·전용률 ' + fmt(rate, 1) + '%';
    }
    function done(ok) { elFeedback.textContent = ok ? '결과를 복사했습니다.' : '복사에 실패했습니다. 결과를 직접 선택해 복사해 주세요.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else { done(false); }
  });

  // 초기 상태: 전용 84㎡ 예시를 결과 영역에만 반영하지 않고 빈 상태로 시작한다.
  setMain(null); onRect(); onAptInput();
})();
