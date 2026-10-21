// 연차 계산기 — 화면 조작 (계산 자체는 calc.js)
(function () {
  var resultEl = document.getElementById('result');
  var errorEl = document.getElementById('error');
  var summaryEl = document.getElementById('summary');
  var feedbackEl = document.getElementById('copy-feedback');
  var lowRowsEl = document.getElementById('low-rows');
  var lastCopyText = '';

  function modeValue() {
    var r = document.querySelectorAll('input[name="mode"]');
    for (var i = 0; i < r.length; i++) if (r[i].checked) return r[i].value;
    return 'retire';
  }
  function syncModeLabel() {
    document.getElementById('end-label').textContent = modeValue() === 'retire' ? '마지막 근무일' : '조회 기준일';
  }
  var modeRadios = document.querySelectorAll('input[name="mode"]');
  for (var i = 0; i < modeRadios.length; i++) modeRadios[i].addEventListener('change', syncModeLabel);
  syncModeLabel();

  function addLowRow(values) {
    values = values || {};
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" inputmode="numeric" class="f-year" value="' + (values.year || '') + '" aria-label="몇 년차"></td>' +
      '<td><input type="text" inputmode="numeric" class="f-months" value="' + (values.months || '') + '" aria-label="개근한 개월 수"></td>' +
      '<td><button type="button" class="remove-row">삭제</button></td>';
    tr.querySelector('.remove-row').addEventListener('click', function () { tr.remove(); });
    lowRowsEl.appendChild(tr);
  }
  document.getElementById('add-low-row').addEventListener('click', function () { addLowRow({}); });

  function readNum(id, label, max, optional) {
    var raw = document.getElementById(id).value;
    if (optional && String(raw).trim() === '') return 0;
    var r = parseField(raw, label, max);
    if (!r.ok) throw new Error(r.message);
    return r.value;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; });
  }

  document.getElementById('calc-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    errorEl.textContent = '';
    resultEl.innerHTML = '';
    summaryEl.hidden = true;
    lastCopyText = '';
    feedbackEl.textContent = '';
    try {
      var hireStr = document.getElementById('hire-date').value;
      var endStr = document.getElementById('end-date').value;
      if (!hireStr) throw new Error('입사일을 입력해 주세요.');
      if (!endStr) throw new Error((modeValue() === 'retire' ? '마지막 근무일' : '조회 기준일') + '을 입력해 주세요.');
      var used = readNum('used-days', '이미 사용한 연차', 10000);
      var wageRaw = document.getElementById('monthly-wage').value;
      var wage = 0;
      if (String(wageRaw).trim() !== '') {
        var wr = parseField(wageRaw, '월 통상임금', 1000000000);
        if (!wr.ok) throw new Error(wr.message);
        wage = wr.value;
      }
      var weekly = readNum('weekly-hours', '주 소정근로시간', 168);
      var daily = readNum('daily-hours', '1일 소정근로시간', 24);
      if (weekly === 0 || daily === 0) throw new Error('근무시간은 0보다 커야 합니다.');
      var prepaid = readNum('prepaid', '이미 지급받은 연차수당', 1000000000, true);
      var lowYears = [];
      var trs = lowRowsEl.querySelectorAll('tr');
      for (var i = 0; i < trs.length; i++) {
        var yr = parseField(trs[i].querySelector('.f-year').value, (i + 1) + '번째 추가 행의 연차');
        if (!yr.ok) throw new Error(yr.message);
        var mo = parseField(trs[i].querySelector('.f-months').value, (i + 1) + '번째 추가 행의 개근 개월 수', 12);
        if (!mo.ok) throw new Error(mo.message);
        if (yr.value < 1 || Math.floor(yr.value) !== yr.value) throw new Error('연차(몇 년차)는 1 이상의 정수로 입력해 주세요.');
        lowYears.push({ yearIndex: yr.value, fullMonths: mo.value });
      }
      var res = calculate({
        mode: modeValue(),
        hireStr: hireStr, endStr: endStr,
        usedDays: used, monthlyWage: wage,
        weeklyHours: weekly, dailyHours: daily,
        workers5plus: document.getElementById('workers5').value,
        hours15plus: document.getElementById('hours15').value,
        promotion: document.getElementById('promotion').value,
        prepaidAllowance: prepaid,
        lowAttendanceYears: lowYears,
        hasSuspensionPeriod: document.getElementById('suspension').checked,
        dayDisplayPolicy: Number(document.getElementById('day-policy').value)
      });
      if (res.status === 'error') throw new Error(res.message);
      if (res.status === 'blocked') {
        resultEl.innerHTML = '<div class="blocked"><h3>계산하지 않는 경우입니다</h3><p>' + esc(res.message) + '</p></div>';
        return;
      }
      render(res, Number(document.getElementById('day-policy').value));
    } catch (e) {
      errorEl.textContent = e.message;
    }
  });

  function render(res, policy) {
    var isRetire = res.mode === 'retire';
    var mainDays = isRetire ? res.settlementDays : res.availableNow;
    document.getElementById('sum-main').textContent = formatDays(applyDayPolicy(mainDays, policy)) + '일';
    document.getElementById('sum-main-lbl').textContent = isRetire ? '정산 대상 연차 (일)' : '지금 사용 가능한 연차 (일)';
    if (res.netAllowance !== null) {
      document.getElementById('sum-sub1').textContent = '약 ' + formatWon(res.netAllowance) + '원';
      document.getElementById('sum-sub2').textContent = formatWon(res.dailyWageDisplay) + '원';
    } else {
      document.getElementById('sum-sub1').textContent = '-';
      document.getElementById('sum-sub2').textContent = '-';
    }
    document.getElementById('sum-sub1-lbl').textContent = '예상 수당 (조건부 예상액)';
    document.getElementById('sum-sub2-lbl').textContent = '1일 통상임금 (기준 ' + res.stdHours + '시간)';
    summaryEl.hidden = false;

    var html = '';
    html += '<h3>결과 상세</h3>';
    html += '<table class="example-table"><tbody>';
    html += '<tr><th>지금까지 발생한 연차 (누적)</th><td>' + formatDays(res.totalAccrued) + '일</td></tr>';
    html += '<tr><th>이미 사용한 연차</th><td>' + formatDays(res.usedDays) + '일</td></tr>';
    html += '<tr><th>사용기간이 지나 소멸된 미사용 연차</th><td>' + formatDays(res.expiredUnused) + '일</td></tr>';
    html += '<tr><th>지금 사용 가능한 연차</th><td>' + formatDays(res.availableNow) + '일</td></tr>';
    if (isRetire) html += '<tr><th>퇴직 정산 대상 연차</th><td>' + formatDays(res.settlementDays) + '일</td></tr>';
    if (res.netAllowance !== null) {
      html += '<tr><th>예상 수당 (기지급 차감 전)</th><td>약 ' + formatWon(res.grossAllowance) + '원</td></tr>';
      if (res.prepaidAllowance > 0) html += '<tr><th>이미 지급받은 수당</th><td>− ' + formatWon(res.prepaidAllowance) + '원</td></tr>';
      html += '<tr><th>예상 수당 (조건부 예상액)</th><td>약 ' + formatWon(res.netAllowance) + '원</td></tr>';
    } else {
      html += '<tr><th>예상 수당</th><td>월 통상임금을 입력하면 수당까지 계산합니다</td></tr>';
    }
    html += '</tbody></table>';

    html += '<h3>발생 내역</h3>';
    html += '<table class="example-table"><thead><tr><th>구분</th><th>발생일</th><th>일수</th><th>사용기간</th><th>상태</th></tr></thead><tbody>';
    res.events.forEach(function (e) {
      html += '<tr><td>' + esc(e.period) + '</td><td>' + e.accrualDate + '</td><td>' + formatDays(e.days) + '일</td><td>' + e.expiryDate + '까지</td><td>' + (e.expired ? '기간 지남' : '사용 가능') + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<p class="note">사용한 연차는 먼저 발생한 것부터 쓴 것으로 계산했습니다. 월 단위 연차의 사용기간은 최초 1년이 끝나는 날까지, 연 단위 연차는 발생한 날부터 1년입니다.</p>';

    // 연차 사용 플래너 — "남은 연차로 가장 길게·효율적으로 쉬는 법"
    var WD = ['일', '월', '화', '수', '목', '금', '토'];
    function fmtMD(str) {
      var d = parseDate(str);
      return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + WD[d.getUTCDay()] + ')';
    }
    function shortHoliday(name) {
      if (!name) return '';
      if (name.indexOf('대체공휴일(') === 0) return '대체·' + name.slice(6, -1);
      return name;
    }
    function breakCardHtml(c, label, isHero) {
      var meta = '총 ' + c.totalDays + '일 · 연차 ' + c.leaveDays + '일';
      if (c.useB > 0) meta += ' (올해 ' + c.useA + '일 + 내년 ' + c.useB + '일)';
      return '<div class="break-card' + (isHero ? ' hero' : '') + '">' +
        '<span class="break-label">' + label + '</span>' +
        '<div class="break-name">' + esc(c.name) + ' — ' + fmtMD(c.start) + ' ~ ' + fmtMD(c.end) + '</div>' +
        '<div class="break-meta">' + meta + '</div>' +
        '<div class="break-note">' + esc(c.note) + '</div></div>';
    }
    function plannerBodyHtml(remain, deadline, next) {
      var br = buildBestBreaks(res.end, remain, deadline, next);
      var out = '';
      if (br.expiringUnused) {
        var dl = parseDate(deadline);
        var when = dl ? (dl.getUTCMonth() + 1) + '월 ' + dl.getUTCDate() + '일' : '소진 기한';
        var hasForced = br.alternatives.some(function (c) { return c.useA >= 1 && c.end <= deadline; });
        out += '<p class="plan-alert">올해 연차 ' + remain + '일이 ' + when + '에 소멸해요. ' +
          (hasForced ? '그 전에 쓰는 조합부터 골랐어요.' : '그 전에 쓸 수 있는 조합을 찾지 못했어요.') + '</p>';
      }
      if (!br.hero) {
        out += '<p>지금 잔여 연차로는 3일 이상 연휴를 만들기 어려워요.</p>';
        return out;
      }
      out += breakCardHtml(br.hero, '가장 긴 휴가', true);
      br.alternatives.forEach(function (c) { out += breakCardHtml(c, '효율 좋은 다른 선택', false); });
      var leaveSet = {};
      br.all.forEach(function (c) { c.leaveDates.forEach(function (ds) { leaveSet[ds] = true; }); });
      function monthGridHtml(grid) {
        var g = '<table class="month-grid"><thead><tr>';
        WD.forEach(function (w) { g += '<th>' + w + '</th>'; });
        g += '</tr></thead><tbody>';
        grid.weeks.forEach(function (week) {
          g += '<tr>';
          week.forEach(function (cell) {
            if (!cell) { g += '<td class="empty"></td>'; return; }
            var cls = 'day-cell';
            if (cell.isWeekend) cls += ' weekend';
            if (cell.holiday) cls += ' holiday';
            if (br.all.some(function (c) { return cell.date >= c.start && cell.date <= c.end; })) cls += ' combo';
            if (leaveSet[cell.date]) cls += ' leave';
            if (cell.date === res.end) cls += ' today';
            g += '<td class="' + cls + '"><span class="d-num">' + cell.day + '</span>';
            if (cell.holiday) g += '<span class="h-name">' + esc(shortHoliday(cell.holiday)) + '</span>';
            g += '</td>';
          });
          g += '</tr>';
        });
        return g + '</tbody></table>';
      }
      var startD = parseDate(res.end);
      for (var mi = 0; mi <= 12; mi++) {
        var md = addMonths(startD, mi);
        var grid = buildMonthGrid(md.getUTCFullYear(), md.getUTCMonth() + 1);
        var firstDate = grid.ym + '-01', lastDate = firstDate;
        grid.weeks.forEach(function (w) { w.forEach(function (cell) { if (cell && cell.date > lastDate) lastDate = cell.date; }); });
        var hasCombo = br.all.some(function (c) { return c.start <= lastDate && c.end >= firstDate; });
        var title = grid.year + '년 ' + grid.month + '월';
        if (hasCombo) out += '<div class="month-card"><h4>' + title + '</h4>' + monthGridHtml(grid) + '</div>';
        else out += '<details class="month-fold"><summary>' + title + ' — 추천 연휴 없음</summary>' + monthGridHtml(grid) + '</details>';
      }
      return out;
    }
    var showPlanner = false;
    var planDefaults = null;
    if (isRetire) {
      html += '<h3>남은 연차로 가장 길게 쉬려면</h3>';
      html += '<p class="note">연차 사용 추천은 \'재직 중 잔여 확인\' 모드에서 볼 수 있어요.</p>';
    } else if (res.availableNow >= 1) {
      showPlanner = true;
      var endYear = Number(res.end.slice(0, 4));
      planDefaults = {
        remain: Math.floor(res.availableNow),
        deadline: endYear + '-12-31',
        marchEnd: (endYear + 1) + '-03-31'
      };
      html += '<h3>남은 연차로 가장 길게 쉬려면</h3>';
      html += '<div class="plan-inputs">';
      html += '<label>올해 잔여 연차 (일)<input type="number" id="plan-remain" min="0" step="1" value="' + planDefaults.remain + '"></label>';
      html += '<label>소진 기한<input type="date" id="plan-deadline" value="' + planDefaults.deadline + '"></label>';
      html += '<span class="plan-presets"><button type="button" id="plan-preset-yearend">올해 말</button><button type="button" id="plan-preset-march">내년 3월 말</button></span>';
      html += '<label>내년 연차 (일)<input type="number" id="plan-next" min="0" step="1" value="0"></label>';
      html += '<button type="button" id="plan-recalc">이 조건으로 다시 추천받기</button>';
      html += '</div>';
      html += '<p class="note">내년 연차는 내년 1월 1일부터 쓸 수 있다고 가정해요. 회사 규정이 다르면 소진 기한을 바꿔 보세요.</p>';
      html += '<div id="plan-body"></div>';
    }

    if (res.warnings.length) {
      html += '<h3>조건과 주의</h3><ul>';
      res.warnings.forEach(function (w) { html += '<li>' + esc(w) + '</li>'; });
      html += '</ul>';
    }
    resultEl.innerHTML = html;

    if (showPlanner) {
      var planBodyEl = document.getElementById('plan-body');
      function refreshPlan() {
        var r = parseInt(document.getElementById('plan-remain').value, 10);
        var n = parseInt(document.getElementById('plan-next').value, 10);
        var dl = document.getElementById('plan-deadline').value;
        planBodyEl.innerHTML = plannerBodyHtml(
          isNaN(r) || r < 0 ? planDefaults.remain : r,
          dl || planDefaults.deadline,
          isNaN(n) || n < 0 ? 0 : n
        );
      }
      refreshPlan();
      document.getElementById('plan-recalc').addEventListener('click', refreshPlan);
      document.getElementById('plan-preset-yearend').addEventListener('click', function () {
        document.getElementById('plan-deadline').value = planDefaults.deadline;
      });
      document.getElementById('plan-preset-march').addEventListener('click', function () {
        document.getElementById('plan-deadline').value = planDefaults.marchEnd;
      });
    }

    var lines = [];
    lines.push('[연차 계산 결과]');
    lines.push((isRetire ? '정산 대상 연차: ' : '지금 사용 가능한 연차: ') + formatDays(applyDayPolicy(mainDays, policy)) + '일');
    lines.push('누적 발생: ' + formatDays(res.totalAccrued) + '일 / 사용: ' + formatDays(res.usedDays) + '일 / 소멸된 미사용: ' + formatDays(res.expiredUnused) + '일');
    if (res.netAllowance !== null) {
      lines.push('1일 통상임금: ' + formatWon(res.dailyWageDisplay) + '원 (월 기준 ' + res.stdHours + '시간)');
      lines.push('예상 수당(약): ' + formatWon(res.netAllowance) + '원 — 조건부 예상액, 확정액이 아닙니다');
    }
    lastCopyText = lines.join('\n');
  }

  document.getElementById('copy-result').addEventListener('click', function () {
    if (!lastCopyText) return;
    function done() { feedbackEl.textContent = '복사했습니다.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastCopyText).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = lastCopyText;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { feedbackEl.textContent = '복사에 실패했습니다.'; }
      ta.remove();
    }
  });

  document.getElementById('load-example').addEventListener('click', function () {
    document.querySelector('input[name="mode"][value="retire"]').checked = true;
    syncModeLabel();
    document.getElementById('hire-date').value = '2024-03-04';
    document.getElementById('end-date').value = '2026-03-03';
    document.getElementById('used-days').value = '10';
    document.getElementById('monthly-wage').value = '3000000';
    document.getElementById('weekly-hours').value = '40';
    document.getElementById('daily-hours').value = '8';
    document.getElementById('prepaid').value = '0';
    document.getElementById('workers5').value = 'yes';
    document.getElementById('hours15').value = 'yes';
    document.getElementById('promotion').value = 'no';
  });
  document.getElementById('reset-input').addEventListener('click', function () {
    document.getElementById('calc-form').reset();
    lowRowsEl.innerHTML = '';
    syncModeLabel();
    resultEl.innerHTML = '';
    errorEl.textContent = '';
    summaryEl.hidden = true;
    lastCopyText = '';
    feedbackEl.textContent = '';
  });
})();
