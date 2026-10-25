// 날짜 계산기 — 화면 조작 (계산 자체는 calc.js)
(function () {
  'use strict';
  var C = window.DateCalc;

  function $(id) { return document.getElementById(id); }
  function todayStr() {
    var n = new Date();
    function p(v) { return (v < 10 ? '0' : '') + v; }
    return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate());
  }
  function copyText(text, feedbackEl) {
    function done(ok) { feedbackEl.textContent = ok ? '결과를 복사했습니다.' : '복사에 실패했습니다. 결과를 직접 선택해 복사해 주세요.'; }
    if (!text) { feedbackEl.textContent = '먼저 날짜를 입력해 주세요.'; return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else { done(false); }
  }

  // ---------- 탭 ----------
  var tabBtns = document.querySelectorAll('.date-tab');
  function selectTab(name) {
    for (var i = 0; i < tabBtns.length; i++) {
      var on = tabBtns[i].getAttribute('data-tab') === name;
      tabBtns[i].setAttribute('aria-selected', on ? 'true' : 'false');
      var panel = $('panel-' + tabBtns[i].getAttribute('data-tab'));
      if (panel) panel.hidden = !on;
    }
  }
  for (var i = 0; i < tabBtns.length; i++) {
    tabBtns[i].addEventListener('click', function () { selectTab(this.getAttribute('data-tab')); });
  }

  // ---------- 1. 날짜 차이 · 디데이 ----------
  var dStart = $('diff-start'), dEnd = $('diff-end'), dInclude = $('diff-include');
  var lastDiffText = '';
  function onDiff() {
    var err = $('diff-error'); err.textContent = '';
    lastDiffText = '';
    var fields = ['diff-dday', 'diff-days', 'diff-incl', 'diff-weeks', 'diff-ymd', 'diff-weekdays', 'diff-business'];
    function clear() { fields.forEach(function (id) { $(id).textContent = '-'; }); $('diff-holidays').textContent = ''; $('diff-warn').textContent = ''; }
    if (!dStart.value || !dEnd.value) { clear(); return; }
    if (!C.parseDate(dStart.value) || !C.parseDate(dEnd.value)) { err.textContent = '날짜를 확인해 주세요.'; clear(); return; }
    var info = C.diffInfo(dStart.value, dEnd.value, {});
    if (!info) { err.textContent = '날짜를 확인해 주세요.'; clear(); return; }
    // 디데이: 오늘 기준 목표일(종료일)까지. 시작일이 오늘이 아니면 두 날짜 차이 기준 표기도 함께 보여 준다
    var today = todayStr();
    $('diff-dday').textContent = C.ddayLabel(today, dEnd.value);
    $('diff-days').textContent = info.days.toLocaleString('ko-KR') + '일';
    $('diff-incl').textContent = (dInclude.checked ? info.inclDays : info.days).toLocaleString('ko-KR') + '일';
    $('diff-weeks').textContent = info.weeks + '주 ' + info.weekRem + '일';
    $('diff-ymd').textContent = info.ymd.years + '년 ' + info.ymd.months + '개월 ' + info.ymd.days + '일';
    $('diff-weekdays').textContent = info.weekdays.toLocaleString('ko-KR') + '일';
    $('diff-business').textContent = info.businessDays.toLocaleString('ko-KR') + '일';
    var holText = info.excludedHolidays.length
      ? '영업일에서 빠진 평일 공휴일: ' + info.excludedHolidays.map(function (h) { return C.fmtKo(h.date) + ' ' + h.name; }).join(' · ')
      : '이 구간에 평일 공휴일은 없습니다.';
    $('diff-holidays').textContent = holText;
    $('diff-warn').textContent = info.partialCoverage
      ? '공휴일 자동 반영은 2026~2027년 구간만 됩니다. 범위 밖 날짜는 주말만 제외하고 셌습니다.'
      : '';
    var ddNote = dStart.value === today ? '' : ' (두 날짜 차이 ' + C.ddayLabel(dStart.value, dEnd.value) + ')';
    lastDiffText = C.fmtKo(dStart.value) + ' → ' + C.fmtKo(dEnd.value) + ': 차이 ' + info.days + '일, '
      + info.weeks + '주 ' + info.weekRem + '일, 영업일 ' + info.businessDays + '일, 오늘 기준 종료일 ' + C.ddayLabel(today, dEnd.value) + ddNote + ' (Afterwork Lab 날짜 계산기)';
  }
  [dStart, dEnd].forEach(function (el) { el.addEventListener('input', onDiff); el.addEventListener('change', onDiff); });
  dInclude.addEventListener('change', onDiff);
  $('diff-today-btn').addEventListener('click', function () { dStart.value = todayStr(); onDiff(); dEnd.focus(); });
  $('diff-copy-btn').addEventListener('click', function () { copyText(lastDiffText, $('diff-feedback')); });
  $('diff-reset-btn').addEventListener('click', function () {
    dStart.value = todayStr(); dEnd.value = ''; dInclude.checked = false; $('diff-feedback').textContent = ''; onDiff(); dEnd.focus();
  });

  // ---------- 2. N일 후 · 전 ----------
  var aBase = $('aft-base'), aN = $('aft-n'), aUnit = $('aft-unit'), aDir = $('aft-dir'), aFirst = $('aft-first');
  var lastAftText = '';
  function onAft() {
    var err = $('aft-error'); err.textContent = '';
    lastAftText = '';
    var out = $('aft-result'), sub = $('aft-sub');
    out.textContent = '-'; sub.textContent = '';
    if (!C.parseDate(aBase.value || '')) { if (aBase.value) err.textContent = '기준일을 확인해 주세요.'; return; }
    var raw = String(aN.value).replace(/,/g, '').trim();
    if (raw === '') return;
    var n = Number(raw);
    if (!isFinite(n) || Math.floor(n) !== n || n < 0) { err.textContent = '0 이상의 정수를 입력해 주세요.'; return; }
    if (n > 36500) { err.textContent = '최대 36,500까지 입력할 수 있습니다.'; return; }
    var res = C.addPeriod(aBase.value, n, aUnit.value, aDir.value, aFirst.checked);
    if (!res) { err.textContent = '계산할 수 없습니다. 입력값을 확인해 주세요.'; return; }
    out.textContent = C.fmtKo(res);
    var unitLabel = { day: '일', week: '주', month: '개월', year: '년' }[aUnit.value];
    var dirLabel = aDir.value === 'before' ? '전' : '후';
    sub.textContent = C.fmtKo(aBase.value) + '에서 ' + n + unitLabel + ' ' + dirLabel
      + (aFirst.checked && aDir.value !== 'before' && (aUnit.value === 'day' || aUnit.value === 'week') ? ' (기준일을 1일째로 셈)' : '')
      + ' · 기준일과의 차이 ' + Math.abs(C.diffDays(C.parseDate(aBase.value), C.parseDate(res))) + '일';
    lastAftText = sub.textContent + ' = ' + C.fmtKo(res) + ' (Afterwork Lab 날짜 계산기)';
  }
  [aBase, aN].forEach(function (el) { el.addEventListener('input', onAft); el.addEventListener('change', onAft); });
  [aUnit, aDir, aFirst].forEach(function (el) { el.addEventListener('change', onAft); });
  $('aft-copy-btn').addEventListener('click', function () { copyText(lastAftText, $('aft-feedback')); });
  $('aft-reset-btn').addEventListener('click', function () {
    aBase.value = todayStr(); aN.value = '100'; aUnit.value = 'day'; aDir.value = 'after'; aFirst.checked = false;
    $('aft-feedback').textContent = ''; onAft(); aN.focus();
  });

  // ---------- 3. 영업일 ----------
  var bStart = $('biz-start'), bN = $('biz-n'), bDir = $('biz-dir'), bExtra = $('biz-extra');
  var lastBizText = '';
  function parseExtra() {
    var raw = String(bExtra.value || '').trim();
    if (!raw) return { list: [], bad: 0 };
    var parts = raw.split(/[\s,]+/).filter(Boolean);
    var list = [], bad = 0;
    parts.forEach(function (p) { if (C.parseDate(p)) list.push(p); else bad++; });
    return { list: list, bad: bad };
  }
  function onBiz() {
    var err = $('biz-error'); err.textContent = '';
    lastBizText = '';
    var out = $('biz-result'), sub = $('biz-sub');
    out.textContent = '-'; sub.textContent = '';
    if (!C.parseDate(bStart.value || '')) { if (bStart.value) err.textContent = '시작일을 확인해 주세요.'; return; }
    var raw = String(bN.value).replace(/,/g, '').trim();
    if (raw === '') return;
    var n = Number(raw);
    if (!isFinite(n) || Math.floor(n) !== n || n < 0) { err.textContent = '0 이상의 정수를 입력해 주세요.'; return; }
    if (n > 3650) { err.textContent = '영업일은 최대 3,650까지 입력할 수 있습니다.'; return; }
    var ex = parseExtra();
    if (ex.bad > 0) { err.textContent = '추가 제외일 중 날짜 형식이 아닌 항목 ' + ex.bad + '개를 무시했습니다. (YYYY-MM-DD)'; }
    var res = C.addBusinessDays(bStart.value, n, bDir.value, ex.list);
    if (!res) { err.textContent = '계산할 수 없습니다. 입력값을 확인해 주세요.'; return; }
    out.textContent = C.fmtKo(res);
    var calDays = Math.abs(C.diffDays(C.parseDate(bStart.value), C.parseDate(res)));
    sub.textContent = '달력으로는 ' + calDays + '일 ' + (bDir.value === 'before' ? '전' : '후')
      + ' · 주말과 2026~2027년 공휴일' + (ex.list.length ? ' + 추가 제외일 ' + ex.list.length + '개' : '') + '를 제외하고 셌습니다. 시작일 당일은 세지 않습니다.';
    if (!C.isCovered(res) || !C.isCovered(bStart.value)) {
      sub.textContent += ' 2026~2027년 밖 구간은 공휴일 데이터가 없어 주말만 제외했습니다.';
    }
    lastBizText = C.fmtKo(bStart.value) + '부터 영업일 ' + n + '일 ' + (bDir.value === 'before' ? '전' : '후') + ' = ' + C.fmtKo(res) + ' (Afterwork Lab 날짜 계산기)';
  }
  [bStart, bN, bExtra].forEach(function (el) { el.addEventListener('input', onBiz); el.addEventListener('change', onBiz); });
  bDir.addEventListener('change', onBiz);
  $('biz-copy-btn').addEventListener('click', function () { copyText(lastBizText, $('biz-feedback')); });
  $('biz-reset-btn').addEventListener('click', function () {
    bStart.value = todayStr(); bN.value = '10'; bDir.value = 'after'; bExtra.value = '';
    $('biz-feedback').textContent = ''; onBiz(); bN.focus();
  });

  // ---------- 4. 만 나이 ----------
  var gBirth = $('age-birth'), gBase = $('age-base');
  var lastAgeText = '';
  function onAge() {
    var err = $('age-error'); err.textContent = '';
    lastAgeText = '';
    var fields = ['age-man', 'age-yeon', 'age-counting', 'age-zodiac'];
    function clear() { fields.forEach(function (id) { $(id).textContent = '-'; }); $('age-next').textContent = ''; $('age-lived').textContent = ''; }
    if (!gBirth.value || !gBase.value) { clear(); return; }
    var info = C.ageInfo(gBirth.value, gBase.value);
    if (!info) { err.textContent = '생년월일과 기준일을 확인해 주세요.'; clear(); return; }
    if (info.error === 'future') { err.textContent = '기준일이 생년월일보다 빠릅니다.'; clear(); return; }
    $('age-man').textContent = '만 ' + info.man + '세';
    $('age-yeon').textContent = info.yeon + '세';
    $('age-counting').textContent = info.counting + '세';
    $('age-zodiac').textContent = info.zodiac + '띠';
    $('age-next').textContent = info.nextBirthdayDays === 0
      ? '오늘이 생일입니다. 만 ' + info.man + '세가 오늘부터 시작됩니다.'
      : '올해 생일은 ' + (info.birthdayPassed ? '지났습니다' : '아직 안 지났습니다')
        + '. 다음 생일은 ' + C.fmtKo(info.nextBirthday) + '로 ' + info.nextBirthdayDays + '일 남았습니다.';
    $('age-lived').textContent = '태어난 날을 1일째로 세면 기준일까지 ' + info.livedDays.toLocaleString('ko-KR') + '일째입니다.';
    lastAgeText = C.fmtKo(gBirth.value) + '생 · ' + C.fmtKo(gBase.value) + ' 기준 만 ' + info.man + '세, 연 나이 ' + info.yeon + '세, 세는 나이 ' + info.counting + '세 (Afterwork Lab 날짜 계산기)';
  }
  [gBirth, gBase].forEach(function (el) { el.addEventListener('input', onAge); el.addEventListener('change', onAge); });
  $('age-copy-btn').addEventListener('click', function () { copyText(lastAgeText, $('age-feedback')); });
  $('age-reset-btn').addEventListener('click', function () {
    gBirth.value = ''; gBase.value = todayStr(); $('age-feedback').textContent = ''; onAge(); gBirth.focus();
  });

  // ---------- 5. 기념일 표 ----------
  var annStart = $('ann-start');
  function onAnn() {
    var err = $('ann-error'); err.textContent = '';
    var tbody = $('ann-rows');
    tbody.innerHTML = '';
    if (!annStart.value) return;
    var list = C.milestones(annStart.value, todayStr());
    if (!list) { err.textContent = '시작일을 확인해 주세요.'; return; }
    list.forEach(function (m) {
      var tr = document.createElement('tr');
      [m.label, C.fmtKo(m.date), m.relLabel].forEach(function (v) {
        var td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  annStart.addEventListener('input', onAnn);
  annStart.addEventListener('change', onAnn);

  // ---------- 초기값 ----------
  var t = todayStr();
  dStart.value = t; aBase.value = t; aN.value = '100';
  bStart.value = t; bN.value = '10';
  gBase.value = t; annStart.value = t;
  selectTab('diff');
  onDiff(); onAft(); onBiz(); onAge(); onAnn();
})();
