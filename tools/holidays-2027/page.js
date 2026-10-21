// 황금연휴 파인더 — 화면 조작 (데이터·계산은 calc.js, 브라우저에서는 전역 함수 사용)
(function () {
  var state = { year: 2027, leave: 2, selectedKey: null, calYear: 2027, calMonth: 1, result: null };
  var tabsEl = document.getElementById('year-tabs');
  var input = document.getElementById('leave-input');
  var status = document.getElementById('finder-status');
  var cardsEl = document.getElementById('combo-cards');
  var calTitle = document.getElementById('cal-title');
  var calGrid = document.getElementById('cal-grid');
  var miniEl = document.getElementById('mini-cals');
  var yearDetails = document.getElementById('year-details');
  var feedback = document.getElementById('copy-feedback');
  var firedUse = false;

  var NAME_SHORT = { '설 연휴': '설', '추석 연휴': '추석', '추석·개천절': '추석' };
  function repName(combo) {
    for (var i = 0; i < combo.names.length; i++) {
      var n = combo.names[i];
      if (n === '대체공휴일') continue;
      return NAME_SHORT[n] || n;
    }
    return '주말 연계';
  }
  function fmtRange(c) { return shortDate(c.start) + '~' + shortDate(c.end); }
  function leaveText(c) {
    if (c.leaveDays === 0) return '연차 없이';
    return '연차 ' + c.leaveDates.map(shortDate).join('·') + ' (' + c.leaveDays + '일)';
  }
  function comboTitle(c) {
    var dt = parseDate(c.start);
    return dt.getUTCFullYear() + '년 ' + repName(c) + ': ' + leaveText(c) + ' → ' + fmtRange(c) + ', 총 ' + c.totalDays + '일';
  }
  function selectedCombo() {
    var r = state.result;
    if (!r) return null;
    var all = [r.hero, r.saver].concat(r.alts).filter(Boolean);
    for (var i = 0; i < all.length; i++) if (all[i].key === state.selectedKey) return all[i];
    return r.hero;
  }
  function markUsed() {
    if (!firedUse && typeof gtag === 'function') { firedUse = true; gtag('event', 'tool_use', { tool: 'holiday-finder' }); }
  }

  function render() {
    var r = findCombos(state.year, state.leave);
    state.result = (r && r.status === 'ok') ? r : null;
    if (!state.result) {
      status.textContent = '연차는 0~30 사이 숫자로 넣어 주세요.';
      cardsEl.innerHTML = '';
      return;
    }
    var yd = YEAR_DATA[String(state.year)];
    if (state.leave === 0) {
      status.textContent = state.year + '년에 연차 없이 쉴 수 있는 연휴예요. 가장 긴 구간부터 보여 드립니다.';
    } else {
      status.textContent = state.year + '년, 연차 ' + state.leave + '개까지 써서 만들 수 있는 구간 ' + state.result.count + '개를 찾았어요.' +
        (yd.status === 'planned' ? ' 2028년은 공식 발표 전 예정 일정이에요.' : '');
    }
    // 선택 유지: 이전 선택이 결과에 없으면 hero로
    var sel = selectedCombo();
    state.selectedKey = sel ? sel.key : null;
    if (sel) { var sd = parseDate(sel.start); state.calYear = sd.getUTCFullYear(); state.calMonth = sd.getUTCMonth() + 1; }
    renderCards();
    renderCalendar();
    renderMinis();
  }

  function cardHtml(c, cls, tag) {
    return '<button type="button" class="combo-card ' + cls + '" data-key="' + c.key + '" aria-pressed="' + (c.key === state.selectedKey) + '">' +
      '<span class="tag">' + tag + '</span><br>' +
      '<span class="range">' + fmtRange(c) + '</span> <span class="total">총 ' + c.totalDays + '일</span><br>' +
      '<span class="detail">' + repName(c) + ' · ' + leaveText(c) + '</span></button>';
  }
  function renderCards() {
    var r = state.result, html = '';
    if (r.hero) html += cardHtml(r.hero, 'hero-card', state.leave === 0 ? '연차 없이 가장 긴 연휴' : '가장 긴 휴가');
    if (r.saver) html += cardHtml(r.saver, '', '연차 절약 — ' + r.saver.efficiency + '배');
    r.alts.forEach(function (c) { html += cardHtml(c, 'alt', '다른 선택'); });
    cardsEl.innerHTML = html || '<p>조건에 맞는 구간이 없습니다.</p>';
    var btns = cardsEl.querySelectorAll('.combo-card');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        state.selectedKey = this.getAttribute('data-key');
        var sel = selectedCombo();
        if (sel) { var sd = parseDate(sel.start); state.calYear = sd.getUTCFullYear(); state.calMonth = sd.getUTCMonth() + 1; }
        markUsed();
        if (typeof gtag === 'function') gtag('event', 'combo_select', { tool: 'holiday-finder' });
        renderCards(); renderCalendar(); renderMinis();
      });
    }
  }

  function dayInfo(dateStr, sel) {
    var names = holidayNameMap(state.year);
    var info = { holiday: names[dateStr] || null, leave: false, inband: false, bandStart: false };
    if (sel && dateStr >= sel.start && dateStr <= sel.end) {
      info.inband = true;
      info.bandStart = dateStr === sel.start;
      for (var i = 0; i < sel.leaveDates.length; i++) if (sel.leaveDates[i] === dateStr) info.leave = true;
    }
    return info;
  }
  function renderCalendar() {
    var sel = selectedCombo();
    var y = state.calYear, m = state.calMonth;
    calTitle.textContent = y + '년 ' + m + '월';
    var first = new Date(Date.UTC(y, m - 1, 1, 12));
    var lead = first.getUTCDay();
    var startDt = addDays(first, -lead);
    var todayStr = fmtDate(new Date());
    var html = '';
    ['일', '월', '화', '수', '목', '금', '토'].forEach(function (d, i) {
      html += '<div class="cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + d + '</div>';
    });
    for (var i = 0; i < 42; i++) {
      var dt = addDays(startDt, i);
      var str = fmtDate(dt);
      var inMonth = dt.getUTCMonth() === m - 1;
      var info = dayInfo(str, sel);
      var dow = dt.getUTCDay();
      var cls = 'cal-cell' + (inMonth ? '' : ' out') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '') +
        (info.holiday ? ' hol' : '') + ((dow === 0 || dow === 6) ? ' weekend' : '') +
        (info.inband ? ' inband' : '') + (info.leave ? ' leave-day' : '') + (str === todayStr ? ' today' : '');
      html += '<div class="' + cls + '"><span class="dnum">' + dt.getUTCDate() + '</span>';
      if (info.holiday) html += '<span class="cal-name">' + info.holiday + '</span>';
      if (info.leave) html += '<span class="cal-leave-tag">연차</span>';
      if (info.bandStart && sel) html += '<span class="cal-band-label">총 ' + sel.totalDays + '일 쉼</span>';
      html += '</div>';
    }
    calGrid.innerHTML = html;
  }
  function renderMinis() {
    var sel = selectedCombo();
    var names = holidayNameMap(state.year);
    var html = '';
    for (var m = 1; m <= 12; m++) {
      var first = new Date(Date.UTC(state.year, m - 1, 1, 12));
      var lead = first.getUTCDay();
      var startDt = addDays(first, -lead);
      var cells = '';
      for (var i = 0; i < 42; i++) {
        var dt = addDays(startDt, i);
        if (dt.getUTCMonth() !== m - 1 && i >= 35) break;
        var str = fmtDate(dt);
        var inMonth = dt.getUTCMonth() === m - 1;
        var cls = 'mini-cell' + (inMonth ? '' : ' out');
        if (names[str]) cls += ' hol';
        if (sel && str >= sel.start && str <= sel.end) {
          cls += sel.leaveDates.indexOf(str) >= 0 ? ' leave-day' : ' inband';
        }
        cells += '<div class="' + cls + '">' + dt.getUTCDate() + '</div>';
      }
      html += '<div class="mini"><h4>' + m + '월</h4><div class="mini-grid">' + cells + '</div></div>';
    }
    miniEl.innerHTML = html;
    var sum = yearDetails.querySelector('summary');
    if (sum) sum.textContent = state.year + '년 전체 달력 한눈에 보기' + (YEAR_DATA[String(state.year)].status === 'planned' ? ' (예정)' : '');
  }

  // ---- 이벤트 ----
  var tabBtns = tabsEl.querySelectorAll('.year-tab');
  for (var t = 0; t < tabBtns.length; t++) {
    tabBtns[t].addEventListener('click', function () {
      state.year = Number(this.getAttribute('data-year'));
      for (var j = 0; j < tabBtns.length; j++) tabBtns[j].setAttribute('aria-selected', tabBtns[j] === this ? 'true' : 'false');
      state.selectedKey = null;
      markUsed();
      render();
    });
  }
  function setLeave(v) {
    var n = Math.max(0, Math.min(30, Math.floor(Number(v) || 0)));
    state.leave = n;
    input.value = n;
    state.selectedKey = null;
    markUsed();
    render();
  }
  input.addEventListener('input', function () {
    var raw = String(input.value).trim();
    if (raw === '') { status.textContent = '쓸 수 있는 연차 개수를 넣으면 바로 계산합니다.'; return; }
    setLeave(raw);
  });
  document.getElementById('leave-minus').addEventListener('click', function () { setLeave(state.leave - 1); });
  document.getElementById('leave-plus').addEventListener('click', function () { setLeave(state.leave + 1); });
  document.getElementById('cal-prev').addEventListener('click', function () {
    state.calMonth -= 1;
    if (state.calMonth < 1) { state.calMonth = 12; state.calYear -= 1; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', function () {
    state.calMonth += 1;
    if (state.calMonth > 12) { state.calMonth = 1; state.calYear += 1; }
    renderCalendar();
  });
  document.getElementById('copy-selected-btn').addEventListener('click', function () {
    var sel = selectedCombo();
    if (!sel) { feedback.textContent = '복사할 구간이 없습니다.'; return; }
    var text = comboTitle(sel) + ' — Afterwork Lab 황금연휴 파인더';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { feedback.textContent = '복사했습니다.'; },
        function () { feedback.textContent = '복사에 실패했습니다. 직접 선택해 복사해 주세요.'; });
    } else {
      feedback.textContent = '이 브라우저에서는 자동 복사가 안 됩니다.';
    }
  });
  render();
})();
