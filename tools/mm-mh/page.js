// MM·MH 공수 변환 계산기 — 화면 조작 (계산 자체는 calc.js)
(function () {
  var rowsEl = document.getElementById('rows');
  var resultEl = document.getElementById('result');
  var errorEl = document.getElementById('error');
  var summaryEl = document.getElementById('summary');
  var feedbackEl = document.getElementById('copy-feedback');
  var lastCopyText = '';

  function addRow(values) {
    values = values || {};
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" inputmode="numeric" class="f-count" value="' + (values.count || '') + '" aria-label="인원(명)"></td>' +
      '<td><input type="text" inputmode="numeric" class="f-days" value="' + (values.days || '') + '" aria-label="근무일(일)"></td>' +
      '<td><input type="text" inputmode="decimal" class="f-hours" value="' + (values.hours || '') + '" aria-label="하루 근무시간(시간)"></td>' +
      '<td><input type="text" inputmode="numeric" class="f-rate" value="' + (values.rate || '') + '" aria-label="참여율(%)"></td>' +
      '<td><button type="button" class="remove-row">삭제</button></td>';
    tr.querySelector('.remove-row').addEventListener('click', function () {
      tr.remove();
    });
    rowsEl.appendChild(tr);
  }

  document.getElementById('add-row').addEventListener('click', function () {
    addRow({ hours: '8', rate: '100' });
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
      var stdHours = readField(document.getElementById('std-hours'), '기준 하루 근무시간', LIMITS.hoursPerDay);
      var workdays = readField(document.getElementById('workdays'), '월 근무일', LIMITS.workdaysPerMonth);
      var stdMonthly = monthlyStandardHours(stdHours, workdays);
      if (stdMonthly === 0) {
        throw new Error('월 기준시간이 0이면 MM으로 변환할 수 없습니다. 기준 하루 근무시간과 월 근무일을 확인해 주세요.');
      }
      var trs = rowsEl.querySelectorAll('tr');
      if (trs.length === 0) throw new Error('인력 행을 하나 이상 추가해 주세요.');
      if (trs.length > LIMITS.maxRows) throw new Error('인력 행은 ' + LIMITS.maxRows + '개까지만 입력할 수 있습니다.');
      var rows = [];
      for (var i = 0; i < trs.length; i++) {
        var t = trs[i];
        var count = readField(t.querySelector('.f-count'), (i + 1) + '번째 인력의 인원', LIMITS.count);
        var days = readField(t.querySelector('.f-days'), (i + 1) + '번째 인력의 근무일', LIMITS.days);
        var hours = readField(t.querySelector('.f-hours'), (i + 1) + '번째 인력의 하루 근무시간', LIMITS.hoursPerDay);
        var rateRaw = parseRate(t.querySelector('.f-rate').value);
        if (!rateRaw.ok) throw new Error((i + 1) + '번째 인력의 ' + rateRaw.message);
        rows.push({ count: count, days: days, hoursPerDay: hours, ratePct: rateRaw.value });
      }
      var total = totalEffort(rows, stdMonthly);
      render(rows, total, stdMonthly, stdHours, workdays);
    } catch (e) {
      errorEl.textContent = e.message;
    }
  });

  function render(rows, total, stdMonthly, stdHours, workdays) {
    if (total.mh === 0) {
      summaryEl.hidden = true;
      lastCopyText = '';
      resultEl.innerHTML = '<p class="no-input">투입이 없습니다. 인원과 근무일을 입력하면 공수가 계산됩니다.</p>' +
        assumptionLine(stdMonthly, stdHours, workdays);
      return;
    }
    document.getElementById('sum-mh').textContent = formatMH(total.mh);
    document.getElementById('sum-mm').textContent = formatMM(total.mm);
    document.getElementById('sum-md').textContent = formatMD(total.md);
    summaryEl.hidden = false;
    var lines = ['MM·MH 공수 변환 결과 (월 기준시간 ' + formatMH(stdMonthly) + '시간)'];
    for (var j = 0; j < rows.length; j++) {
      lines.push('- ' + (j + 1) + '번째 인력: ' + rows[j].count + '명, ' + rows[j].days + '일, 하루 ' + rows[j].hoursPerDay + '시간, 참여율 ' + rows[j].ratePct + '% → ' + formatMH(total.rows[j].mh) + ' MH / ' + formatMM(total.rows[j].mm) + ' MM');
    }
    lines.push('합계: 총 ' + formatMH(total.mh) + ' MH · ' + formatMM(total.mm) + ' MM · 총공수 ' + formatMD(total.md) + ' MD');
    lastCopyText = lines.join('\n');
    var html = '<table class="result-table"><thead><tr>' +
      '<th>인력</th><th>인원</th><th>근무일</th><th>하루 근무시간</th><th>참여율</th><th>공수(MH)</th><th>공수(MM)</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
      html += '<tr><td>' + (i + 1) + '번째</td><td>' + rows[i].count + '명</td><td>' + rows[i].days + '일</td>' +
        '<td>' + rows[i].hoursPerDay + '시간</td><td>' + rows[i].ratePct + '%</td>' +
        '<td>' + formatMH(total.rows[i].mh) + '</td><td>' + formatMM(total.rows[i].mm) + '</td></tr>';
    }
    html += '<tr class="total"><td>합계</td><td colspan="4">총공수 ' + formatMD(total.md) + 'MD</td>' +
      '<td>' + formatMH(total.mh) + ' MH</td><td>' + formatMM(total.mm) + ' MM</td></tr>';
    html += '</tbody></table>';
    html += assumptionLine(stdMonthly, stdHours, workdays);
    resultEl.innerHTML = html;
  }

  function assumptionLine(stdMonthly, stdHours, workdays) {
    return '<p class="assumption">월 기준시간 ' + formatMH(stdMonthly) + '시간으로 계산했습니다 ' +
      '(기준 하루 근무시간 ' + stdHours + '시간 × 월 근무일 ' + workdays + '일). ' +
      'MM(인월) 변환에 쓰인 월 기준시간은 입력하신 값 기준입니다. 기관·회사마다 인월 산정 기준이 다를 수 있으니, ' +
      '제출·보고 용도로 쓰실 때는 제출처의 기준과 같은지 먼저 확인하시기 바랍니다.</p>';
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
    addRow({ count: '1', days: '20', hours: '8', rate: '100' });
    addRow({ count: '1', days: '20', hours: '8', rate: '50' });
    document.getElementById('calc-form').requestSubmit();
  });

  document.getElementById('reset-input').addEventListener('click', function () {
    document.getElementById('std-hours').value = '8';
    document.getElementById('workdays').value = '20';
    rowsEl.innerHTML = '';
    addRow({ count: '1', days: '20', hours: '8', rate: '100' });
    errorEl.textContent = '';
    resultEl.innerHTML = '';
    summaryEl.hidden = true;
    lastCopyText = '';
    feedbackEl.textContent = '';
  });

  addRow({ count: '1', days: '20', hours: '8', rate: '100' });
})();
