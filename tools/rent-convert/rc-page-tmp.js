// 전월세 전환 계산기 (제시 월세 상한 판정) — 화면 조작 (계산 자체는 calc.js)
// 입력 금액은 만원 단위, calc.js에는 원 단위로 넘긴다.
(function () {
  'use strict';
  var C = window.RentConvertCalc;
  var MAN = 10000;

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
  function fmtRate(v) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    return (Math.round(v * 100) / 100).toLocaleString('ko-KR') + '%';
  }

  var els = {
    jeonse: $('rc-jeonse'), keep: $('rc-keep'), proposed: $('rc-proposed'),
    baseRate: $('rc-base-rate'), situation: $('rc-situation'), months: $('rc-months'),
    verdict: $('rc-verdict'), capMonthly: $('rc-cap-monthly'),
    appliedRate: $('rc-applied-rate'), excessMonthly: $('rc-excess-monthly'),
    bConverted: $('rc-b-converted'), bCapRate: $('rc-b-cap-rate'),
    bCapMonthly: $('rc-b-cap-monthly'), bExcessYear: $('rc-b-excess-year'),
    bExcessTerm: $('rc-b-excess-term'), bPaid: $('rc-b-paid'),
    adjA: $('rc-adj-a'), adjB: $('rc-adj-b'),
    tableBody: $('rc-table-body'),
    error: $('rc-error'), note: $('rc-note'),
    copyBtn: $('rc-copy-btn'), resetBtn: $('rc-reset-btn'),
    exampleBtn: $('rc-example-btn'), feedback: $('rc-feedback')
  };
  var last = null;

  function setError(msg) { els.error.textContent = msg || ''; }

  function readInputs() {
    var jeonseM = parseNum(els.jeonse);
    var keepM = parseNum(els.keep);
    var proposedM = parseNum(els.proposed);
    var baseRate = parseNum(els.baseRate);
    var monthsRaw = parseNum(els.months);
    return {
      jeonse: (jeonseM === null || isNaN(jeonseM)) ? null : Math.round(jeonseM * MAN),
      keepDeposit: (keepM === null || isNaN(keepM)) ? null : Math.round(keepM * MAN),
      proposed: (proposedM === null || isNaN(proposedM)) ? null : Math.round(proposedM * MAN),
      baseRate: baseRate,
      monthsPaid: (monthsRaw === null || isNaN(monthsRaw)) ? 0 : monthsRaw,
      situation: els.situation.value,
      valid: jeonseM !== null && !isNaN(jeonseM) && keepM !== null && !isNaN(keepM)
        && proposedM !== null && !isNaN(proposedM) && baseRate !== null && !isNaN(baseRate)
        && !(monthsRaw !== null && isNaN(monthsRaw))
    };
  }

  function update() {
    els.feedback.textContent = '';
    var inp = readInputs();
    if (!inp.valid) {
      setError('전세보증금, 남길 보증금, 제시받은 월세, 기준금리를 넣어 주세요.');
      last = null;
      return;
    }
    var r = C.compute({
      jeonse: inp.jeonse, keepDeposit: inp.keepDeposit, proposed: inp.proposed,
      baseRate: inp.baseRate, monthsPaid: inp.monthsPaid
    });
    if (!r) {
      setError('입력값을 확인해 주세요. 남길 보증금은 전세보증금보다 클 수 없고, 월세로 전환할 금액이 있어야 합니다.');
      last = null;      return;
    }
    setError('');
    r.situation = inp.situation;
    last = r;
    var isNew = inp.situation === 'new';
    if (r.isOver) {
      els.verdict.textContent = isNew
        ? '참고 상한을 ' + fmtWon(r.excess) + ' 초과 (신규 계약은 참고 판정)'
        : '법정 상한을 월 ' + fmtWon(r.excess) + ' 초과';
    } else if (r.isAtCap) {
      els.verdict.textContent = '법정 상한과 같습니다';
    } else {
      els.verdict.textContent = '상한 이내 — 월 ' + fmtWon(r.margin) + ' 여유';
    }
    els.capMonthly.textContent = fmtWon(r.capMonthly);
    els.appliedRate.textContent = fmtRate(r.appliedRate) + ' (상한 ' + fmtRate(r.capRate) + ')';
    els.excessMonthly.textContent = r.isOver ? fmtWon(r.excess) : '0원';
    els.bConverted.textContent = fmtWon(r.converted) + ' (전세 ' + fmtWon(r.jeonse) + ' − 남길 보증금 ' + fmtWon(r.keepDeposit) + ')';
    els.bCapRate.textContent = '연 ' + fmtRate(r.capRate) + ' = min(연 10%, 기준금리 ' + fmtRate(r.baseRate) + ' + 2%)';
    els.bCapMonthly.textContent = fmtWon(r.capMonthly) + ' (전환액 × 상한율 ÷ 12, 원 미만 절사)';
    els.bExcessYear.textContent = r.isOver ? fmtWon(r.excessYear) : '-';
    els.bExcessTerm.textContent = r.isOver ? fmtWon(r.excessTerm) + ' (24개월 기준)' : '-';
    els.bPaid.textContent = r.isOver
      ? (r.monthsPaid > 0 ? fmtWon(r.paidExcess) + ' (' + r.monthsPaid + '개월 × 월 초과액)' : '이미 낸 개월 수를 넣으면 계산됩니다')
      : '-';
    els.adjA.textContent = r.isOver
      ? '월세를 ' + fmtWon(r.capMonthly) + ' 이하로 내리면 상한 이내입니다 (월 ' + fmtWon(r.excess) + ' 인하)'
      : '조정할 필요가 없습니다';
    els.adjB.textContent = !r.isOver
      ? '-'
      : (r.planBFeasible
        ? '월세 ' + fmtWon(r.proposed) + '을 유지하려면 남길 보증금을 ' + fmtWon(r.requiredKeep) + '으로 바꿔야 합니다 (지금보다 ' + (r.keepChange === 0 ? '변화 없음' : (r.keepChange > 0 ? fmtWon(r.keepChange) + ' 더 남김' : fmtWon(-r.keepChange) + ' 덜 남김')) + '). 보증금을 덜 남기면 전환액이 커져 같은 월세의 적용 전환율이 낮아지는 구조입니다.'
        : '월세 ' + fmtWon(r.proposed) + '을 유지하는 보증금 조정은 불가능합니다. 남길 보증금을 0원으로 해 전액 전환해도 상한 월세는 ' + fmtWon(C.capMonthly(r.jeonse, r.capRate)) + '까지만 올라가 제시 월세에 닿지 않습니다. 월세를 조정안 A만큼 내리는 쪽이 필요합니다.');
    els.note.textContent = r.isOver
      ? (isNew
        ? '신규 계약에서는 법정 상한이 강제되지 않아 당사자 합의로 정해집니다. 이 숫자는 협상할 때의 참고 기준이며, 같은 집에 계속 살면서 바꾸는 갱신·기간 중 전환과는 다릅니다.'
        : '계약 기간 중 전환이나 갱신에서는 이 상한을 넘는 월차임 약정은 임차인에게 불리한 약정으로 효력이 제한될 수 있습니다. 초과분은 기록이 남는 방식(문자·내용증명)으로 조정 요청을 하고, 합의가 안 되면 주택임대차분쟁조정위원회 상담을 검토하세요.')
      : '제시된 월세가 법정 상한 안에 있습니다. 다만 상한은 계약 체결일의 기준금리로 판단하므로, 계약일이 다르면 기준금리를 그날 값으로 바꿔 다시 확인하세요.';    var rows = C.depositTable({ jeonse: inp.jeonse, keepDeposit: inp.keepDeposit, baseRate: inp.baseRate });
    var html = '';
    if (rows) {
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        html += '<tr' + (row.isCurrent ? ' class="total"' : '') + '><td>' + fmtWon(row.keepDeposit) + (row.isCurrent ? ' (지금 조건)' : '') + '</td><td>' + fmtWon(row.converted) + '</td><td>' + fmtWon(row.capMonthly) + '</td></tr>';
      }
    }
    els.tableBody.innerHTML = html;
  }

  function formatField(el) {
    var v = parseNum(el);
    if (v !== null && isFinite(v)) el.value = v.toLocaleString('ko-KR');
  }

  ['input', 'change'].forEach(function (ev) {
    [els.jeonse, els.keep, els.proposed, els.baseRate, els.months].forEach(function (el) {
      el.addEventListener(ev, update);
    });
    els.situation.addEventListener(ev, update);
  });
  [els.jeonse, els.keep, els.proposed].forEach(function (el) {
    el.addEventListener('change', function () { formatField(el); });
  });

  els.exampleBtn.addEventListener('click', function () {
    els.jeonse.value = '50,000';
    els.keep.value = '30,000';
    els.proposed.value = '100';
    els.baseRate.value = '3.00';
    els.situation.value = 'renewal';
    els.months.value = '';
    update();
  });
  els.resetBtn.addEventListener('click', function () {
    els.jeonse.value = '30,000';    els.keep.value = '10,000';
    els.proposed.value = '85';
    els.baseRate.value = '3.00';
    els.situation.value = 'renewal';
    els.months.value = '';
    update();
  });
  els.copyBtn.addEventListener('click', function () {
    if (!last) { els.feedback.textContent = '먼저 계산 결과가 있어야 복사할 수 있습니다.'; return; }
    var text = '전월세 전환 상한 판정 (Afterwork Lab 전월세 전환 계산기)\n'
      + '전세 ' + fmtWon(last.jeonse) + ' · 남길 보증금 ' + fmtWon(last.keepDeposit) + ' · 제시 월세 ' + fmtWon(last.proposed) + '\n'
      + '법정 상한율: 연 ' + fmtRate(last.capRate) + ' (기준금리 ' + fmtRate(last.baseRate) + ' + 2%와 10% 중 낮은 값)\n'
      + '상한 월세: ' + fmtWon(last.capMonthly) + ' · 적용 전환율: ' + fmtRate(last.appliedRate) + '\n'
      + '판정: ' + els.verdict.textContent;
    if (last.isOver) {
      text += '\n월 초과액 ' + fmtWon(last.excess) + ' · 연 ' + fmtWon(last.excessYear) + ' · 24개월 ' + fmtWon(last.excessTerm);
    }
    function done() { els.feedback.textContent = '결과를 복사했습니다.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { els.feedback.textContent = '복사에 실패했습니다.'; });    } else {
      els.feedback.textContent = '이 브라우저에서는 복사를 지원하지 않습니다.';
    }
  });

  update();
})();
