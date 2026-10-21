// 2027 공휴일 플래너 — 화면 조작 (데이터·계산은 calc.js, 브라우저에서는 전역 함수 사용)
// calc.js는 Node 테스트 겸용이라 브라우저에서는 같은 파일의 전역 정의를 그대로 쓴다.
(function () {
  var input = document.getElementById('remaining-input');
  var status = document.getElementById('plan-status');
  var listEl = document.getElementById('plan-list');
  var feedback = document.getElementById('copy-feedback');
  var fired = false;

  // 브라우저 환경: calc.js의 전역 PLANS/filterPlans/shortDate를 쓴다.
  function fmtRange(p) {
    return shortDate(p.start) + '~' + shortDate(p.end);
  }
  function planText(p) {
    return p.title + ' — 연차 ' + p.leaveDates.map(shortDate).join(', ') + ' (' + p.leaveDays + '일) → ' +
      fmtRange(p) + ', 총 ' + p.totalDays + '일';
  }
  function render() {
    var raw = String(input.value).trim();
    if (raw === '') {
      status.textContent = '잔여 연차를 넣으면 그 범위 안에서 가능한 조합만 골라 보여 드립니다. 비워 두면 전체 조합을 보여 드립니다.';
      renderList(PLANS.map(planWithTotals));
      return;
    }
    var r = filterPlans(raw);
    if (r.status !== 'ok') {
      status.textContent = r.message;
      listEl.innerHTML = '';
      return;
    }
    if (r.count === 0) {
      status.textContent = '잔여 연차 ' + r.remaining + '일로는 만들 수 있는 조합이 없습니다. 연차 1일부터 가능한 조합이 있습니다.';
    } else {
      status.textContent = '잔여 연차 ' + r.remaining + '일로 가능한 조합 ' + r.count + '개입니다. 연차 1일당 쉬는 날이 많은 순서로 정렬했습니다.';
    }
    renderList(r.plans);
    if (!fired && typeof gtag === 'function') { fired = true; gtag('event', 'tool_use', { tool: 'holidays-2027' }); }
  }
  function renderList(plans) {
    plans.sort(function (a, b) {
      if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
      if (b.totalDays !== a.totalDays) return b.totalDays - a.totalDays;
      return a.start < b.start ? -1 : 1;
    });
    listEl.innerHTML = plans.map(function (p) {
      return '<li class="plan-item"><strong>' + p.title + '</strong> — 연차 ' + p.leaveDates.map(shortDate).join(', ') +
        ' (' + p.leaveDays + '일) → ' + fmtRange(p) + ', <strong>총 ' + p.totalDays + '일</strong>' +
        ' <button type="button" class="copy-plan" data-plan="' + p.id + '">이 조합 복사</button></li>';
    }).join('');
    var btns = listEl.querySelectorAll('.copy-plan');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var id = this.getAttribute('data-plan');
        var found = null;
        plans.forEach(function (p) { if (p.id === id) found = p; });
        if (found) copyText(planText(found));
      });
    }
  }
  function copyText(text) {
    function done() { feedback.textContent = '복사했습니다.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { feedback.textContent = '복사에 실패했습니다. 직접 선택해 복사해 주세요.'; });
    } else {
      feedback.textContent = '이 브라우저에서는 자동 복사가 안 됩니다.';
    }
  }
  input.addEventListener('input', render);
  document.getElementById('reset-btn').addEventListener('click', function () {
    input.value = '';
    feedback.textContent = '';
    render();
    input.focus();
  });
  document.getElementById('copy-all-btn').addEventListener('click', function () {
    var items = listEl.querySelectorAll('.plan-item');
    var lines = [];
    for (var i = 0; i < items.length; i++) lines.push(items[i].textContent.replace('이 조합 복사', '').trim());
    if (!lines.length) { feedback.textContent = '복사할 조합이 없습니다.'; return; }
    copyText('2027 연차 조합 (Afterwork Lab)\n' + lines.join('\n'));
  });
  render();
})();
