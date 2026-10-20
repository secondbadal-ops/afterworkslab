// 프로젝트 견적 시뮬레이터 — 화면 조작 (계산 자체는 calc.js)
(function () {
  var rowsEl = document.getElementById('rows');
  var resultEl = document.getElementById('result');
  var errorEl = document.getElementById('error');
  var summaryEl = document.getElementById('summary');
  var feedbackEl = document.getElementById('copy-feedback');
  var lastCopyText = '';

  var BASIS_LABEL = { hour: '시간당', day: '일당', month: '월단가' };

  function addRow(values) {
    values = values || {};
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" class="f-name wide" value="' + (values.name || '') + '" aria-label="역할 이름" placeholder="예: 개발"></td>' +
      '<td><input type="text" inputmode="numeric" class="f-count" value="' + (values.count || '') + '" aria-label="인원(명)"></td>' +
      '<td><input type="text" inputmode="numeric" class="f-days" value="' + (values.days || '') + '" aria-label="근무일(일)"></td>' +
      '<td><select class="f-basis" aria-label="단가 기준">' +
      '<option value="hour"' + (values.basis === 'hour' ? ' selected' : '') + '>시간당</option>' +
      '<option value="day"' + (values.basis === 'day' ? ' selected' : '') + '>일당</option>' +
      '<option value="month"' + (values.basis === 'month' ? ' selected' : '') + '>월단가</option>' +
      '</select></td>' +
      '<td><input type="text" inputmode="numeric" class="f-price wide" value="' + (values.price || '') + '" aria-label="단가(원)"></td>' +
      '<td><input type="text" inputmode="numeric" class="f-rate" value="' + (values.rate || '') + '" aria-label="참여율(%)"></td>' +
      '<td><button type="button" class="remove-row">삭제</button></td>';
    tr.querySelector('.remove-row').addEventListener('click', function () {
      tr.remove();
    });
    rowsEl.appendChild(tr);
  }

  document.getElementById('add-row').addEventListener('click', function () {
    addRow({ basis: 'hour', rate: '100' });
  });

  function readField(input, label, max) {
    var r = parseField(input.value, label, max);
    if (!r.ok) throw new Error(r.message);
    return r.value;
  }

  document.getElementById('calc-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    errorEl.textContent = '';
    resultEl.innerHTML = '';
    summaryEl.hidden = true;
    lastCopyText = '';
    feedbackEl.textContent = '';
    try {
      var hoursPerDay = readField(document.getElementById('std-hours'), '기준 하루 근무시간', LIMITS.hoursPerDay);
      var workdaysPerMonth = readField(document.getElementById('workdays'), '월 근무일', LIMITS.workdaysPerMonth);
      var stdMonthly = monthlyStandardHours(hoursPerDay, workdaysPerMonth);
      if (stdMonthly === 0) {
        throw new Error('월 기준시간이 0이면 MM으로 변환할 수 없습니다. 기준 하루 근무시간과 월 근무일을 확인해 주세요.');
      }
      var trs = rowsEl.querySelectorAll('tr');
      if (trs.length === 0) throw new Error('인력 행을 하나 이상 추가해 주세요.');
      if (trs.length > LIMITS.maxRows) throw new Error('인력 행은 ' + LIMITS.maxRows + '개까지만 입력할 수 있습니다.');
      var rows = [];
      for (var i = 0; i < trs.length; i++) {
        var t = trs[i];
        var label = (i + 1) + '번째 인력의 ';
        var name = t.querySelector('.f-name').value.trim() || (i + 1) + '번째 인력';
        var count = readField(t.querySelector('.f-count'), label + '인원', LIMITS.count);
        var days = readField(t.querySelector('.f-days'), label + '근무일', LIMITS.days);
        var basis = t.querySelector('.f-basis').value;
        var price = readField(t.querySelector('.f-price'), label + '단가', LIMITS.unitPrice);
        var rateRaw = parseRate(t.querySelector('.f-rate').value);
        if (!rateRaw.ok) throw new Error(label + rateRaw.message);
        rows.push({ name: name, count: count, days: days, rateBasis: basis, unitPrice: price, ratePct: rateRaw.value });
      }
      var overheadRaw = parseOptionalRate(document.getElementById('overhead').value, '제경비 요율');
      if (!overheadRaw.ok) throw new Error(overheadRaw.message);
      var techRaw = parseOptionalRate(document.getElementById('tech').value, '기술료 요율');
      if (!techRaw.ok) throw new Error(techRaw.message);
      var expenseRaw = parseOptional(document.getElementById('direct-expense').value, '직접경비', LIMITS.directExpense);
      if (!expenseRaw.ok) throw new Error(expenseRaw.message);
      var vatMode = document.querySelector('input[name="vat"]:checked').value;
      var ctx = { hoursPerDay: hoursPerDay, workdaysPerMonth: workdaysPerMonth, stdMonthlyHours: stdMonthly };
      var add = { overheadPct: overheadRaw.value, techPct: techRaw.value, directExpense: expenseRaw.value, vatMode: vatMode };
      var est = estimate(rows, ctx, add);
      if (!isFinite(est.labor) || !isFinite(est.subtotal) || !isFinite(est.grandTotal) || !isFinite(est.totalMH)) {
        throw new Error('계산 결과가 너무 큽니다. 입력값을 줄여서 다시 시도해 주세요.');
      }
      render(rows, est, ctx, add);
    } catch (e) {
      errorEl.textContent = e.message;
    }
  });

  function render(rows, est, ctx, add) {
    if (est.totalMD === 0) {
      summaryEl.hidden = true;
      lastCopyText = '';
      resultEl.innerHTML = '<p class="no-input">투입이 없습니다. 인원과 근무일을 입력하면 공수와 인건비가 계산됩니다.</p>' +
        assumptionList(ctx, add);
      return;
    }
    var supply = add.vatMode === 'included' ? est.subtotal - est.vat : est.subtotal;
    document.getElementById('sum-total').textContent = formatKRW(est.grandTotal);
    document.getElementById('sum-supply').textContent = formatKRW(supply);
    document.getElementById('sum-labor').textContent = formatKRW(est.labor);
    document.getElementById('sum-mm').textContent = formatMM(est.totalMM);
    summaryEl.hidden = false;
    var lines = ['프로젝트 견적 시뮬레이션 결과 (참고값, 월 기준시간 ' + formatMH(ctx.stdMonthlyHours) + '시간)'];
    for (var j = 0; j < rows.length; j++) {
      lines.push('- ' + rows[j].name + ': ' + rows[j].count + '명, ' + rows[j].days + '일, 참여율 ' + rows[j].ratePct + '%, ' + BASIS_LABEL[rows[j].rateBasis] + ' ' + formatKRW(rows[j].unitPrice) + '원 → ' + formatMD(est.rows[j].md) + ' MD / ' + formatMM(est.rows[j].mm) + ' MM / ' + formatKRW(est.rows[j].cost) + '원');
    }
    lines.push('직접 인건비: ' + formatKRW(est.labor) + '원');
    lines.push('제경비 (' + add.overheadPct + '%): ' + formatKRW(est.overhead) + '원');
    lines.push('기술료 (' + add.techPct + '%): ' + formatKRW(est.tech) + '원');
    lines.push('직접경비: ' + formatKRW(est.directExpense) + '원');
    lines.push('공급가액: ' + formatKRW(supply) + '원');
    lines.push('부가가치세: ' + formatKRW(est.vat) + '원' + (add.vatMode === 'included' ? ' (포함 금액에서 역산)' : ' (10% 가산)'));
    lines.push('최종 견적금액 (부가세 포함): ' + formatKRW(est.grandTotal) + '원');
    lines.push('총공수: ' + formatMD(est.totalMD) + ' MD · ' + formatMM(est.totalMM) + ' MM · 최장 인력 투입기간 ' + est.periodDays + '근무일');
    lines.push('※ 입력값 기준 참고용 추정치입니다. 실제 계약금액은 조건에 따라 달라질 수 있습니다.');
    lastCopyText = lines.join('\n');
    var html = '<table class="result-table"><thead><tr>' +
      '<th>역할</th><th>인원</th><th>근무일</th><th>참여율</th><th>단가</th><th>공수(MD)</th><th>공수(MM)</th><th>인건비(원)</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
      html += '<tr><td>' + escapeHtml(rows[i].name) + '</td><td>' + rows[i].count + '명</td><td>' + rows[i].days + '일</td>' +
        '<td>' + rows[i].ratePct + '%</td>' +
        '<td>' + BASIS_LABEL[rows[i].rateBasis] + ' ' + formatKRW(rows[i].unitPrice) + '원</td>' +
        '<td>' + formatMD(est.rows[i].md) + '</td><td>' + formatMM(est.rows[i].mm) + '</td>' +
        '<td>' + formatKRW(est.rows[i].cost) + '</td></tr>';
    }
    html += '<tr class="total"><td>합계</td><td colspan="4">최장 인력 투입기간 ' + est.periodDays + '근무일 · 총공수 ' + formatMD(est.totalMD) + 'MD</td>' +
      '<td>' + formatMD(est.totalMD) + '</td><td>' + formatMM(est.totalMM) + '</td><td>' + formatKRW(est.labor) + '</td></tr>';
    html += '</tbody></table>';

    html += '<table class="result-table"><thead><tr><th>구성 요소</th><th>금액(원)</th></tr></thead><tbody>';
    html += '<tr><td>직접 인건비</td><td>' + formatKRW(est.labor) + '</td></tr>';
    html += '<tr><td>제경비 (직접 인건비 × ' + add.overheadPct + '%)</td><td>' + formatKRW(est.overhead) + '</td></tr>';
    html += '<tr><td>기술료 ((직접 인건비 + 제경비) × ' + add.techPct + '%)</td><td>' + formatKRW(est.tech) + '</td></tr>';
    html += '<tr><td>직접경비 (직접 입력)</td><td>' + formatKRW(est.directExpense) + '</td></tr>';
    if (add.vatMode === 'included') {
      html += '<tr><td>공급가액 (부가세 포함 금액에서 역산)</td><td>' + formatKRW(est.subtotal - est.vat) + '</td></tr>';
      html += '<tr><td>부가가치세 (내포 세액)</td><td>' + formatKRW(est.vat) + '</td></tr>';
    } else {
      html += '<tr><td>공급가액</td><td>' + formatKRW(est.subtotal) + '</td></tr>';
      html += '<tr><td>부가가치세 (10% 가산)</td><td>' + formatKRW(est.vat) + '</td></tr>';
    }
    html += '<tr class="total"><td>최종 견적금액 (부가세 포함)</td><td>' + formatKRW(est.grandTotal) + '원</td></tr>';
    html += '</tbody></table>';
    html += assumptionList(ctx, add);
    resultEl.innerHTML = html;
  }

  function assumptionList(ctx, add) {
    var vatText = add.vatMode === 'included' ? '입력 금액에 포함된 것으로 보고 역산 (세율 10%)' : '공급가액에 10% 가산';
    return '<p class="assumption">적용한 가정: 월 기준시간 ' + formatMH(ctx.stdMonthlyHours) + '시간 ' +
      '(기준 하루 근무시간 ' + ctx.hoursPerDay + '시간 × 월 근무일 ' + ctx.workdaysPerMonth + '일), ' +
      '월단가는 투입 개월(근무일 ÷ 월 근무일 ' + ctx.workdaysPerMonth + '일)로 환산, ' +
      '제경비 ' + add.overheadPct + '%, 기술료 ' + add.techPct + '%, 직접경비 ' + formatKRW(add.directExpense) + '원, ' +
      '부가가치세 ' + vatText + '. 최장 인력 투입기간은 개별 인력의 투입 기간 중 가장 긴 기간이며, 인력 간 작업 순서와 일정 중첩은 고려하지 않으므로 전체 프로젝트 수행기간과 다를 수 있습니다.</p>';
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  document.getElementById('copy-result').addEventListener('click', function () {
    if (!lastCopyText) {
      feedbackEl.textContent = '먼저 계산해 주세요.';
      return;
    }
    function done() {
      feedbackEl.textContent = '결과를 복사했습니다.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastCopyText).then(done, function () {
        feedbackEl.textContent = '복사에 실패했습니다.';
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = lastCopyText;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } catch (e) {
        feedbackEl.textContent = '복사에 실패했습니다.';
      }
      ta.remove();
    }
  });

  document.getElementById('load-example').addEventListener('click', function () {
    document.getElementById('std-hours').value = '8';
    document.getElementById('workdays').value = '20';
    rowsEl.innerHTML = '';
    addRow({ name: '개발', count: '2', days: '20', basis: 'hour', price: '50000', rate: '100' });
    addRow({ name: 'PM', count: '1', days: '40', basis: 'month', price: '8000000', rate: '50' });
    document.getElementById('overhead').value = '10';
    document.getElementById('tech').value = '10';
    document.getElementById('direct-expense').value = '500000';
    document.querySelector('input[name="vat"][value="separate"]').checked = true;
    document.getElementById('calc-form').requestSubmit();
  });

  document.getElementById('reset-input').addEventListener('click', function () {
    document.getElementById('std-hours').value = '8';
    document.getElementById('workdays').value = '20';
    rowsEl.innerHTML = '';
    addRow({ name: '개발', count: '2', days: '20', basis: 'hour', price: '50000', rate: '100' });
    document.getElementById('overhead').value = '';
    document.getElementById('tech').value = '';
    document.getElementById('direct-expense').value = '';
    document.querySelector('input[name="vat"][value="separate"]').checked = true;
    errorEl.textContent = '';
    resultEl.innerHTML = '';
    summaryEl.hidden = true;
    lastCopyText = '';
    feedbackEl.textContent = '';
  });

  addRow({ name: '개발', count: '2', days: '20', basis: 'hour', price: '50000', rate: '100' });
})();
