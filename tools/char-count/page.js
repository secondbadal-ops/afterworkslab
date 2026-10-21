// 글자수 세기 — 화면 조작 (계산 자체는 count.js)
(function () {
  var input = document.getElementById('text-input');
  var elWith = document.getElementById('count-with');
  var elWithout = document.getElementById('count-without');
  var elWords = document.getElementById('count-words');
  var elBytes = document.getElementById('count-bytes');
  var elNote = document.getElementById('limit-note');
  var elFeedback = document.getElementById('copy-feedback');
  var targetInput = document.getElementById('target-input');
  var targetBasis = document.getElementById('target-basis');
  var targetStatus = document.getElementById('target-status');
  var targetBar = document.getElementById('target-bar');
  var fired = false;

  function fmt(n) {
    return n.toLocaleString('ko-KR');
  }

  function updateTarget(r) {
    var target = parseInt(String(targetInput.value).replace(/[^0-9]/g, ''), 10);
    if (!target || target <= 0) {
      targetStatus.textContent = '목표를 넣으면 남은 글자수를 알려 드립니다.';
      targetStatus.className = 'target-status';
      targetBar.style.width = '0';
      targetBar.className = 'progress-bar';
      return;
    }
    var current = targetBasis.value === 'without' ? r.charsWithoutSpace : r.charsWithSpace;
    var pct = Math.min(100, Math.round((current / target) * 100));
    targetBar.style.width = pct + '%';
    if (current > target) {
      targetStatus.textContent = '목표보다 ' + fmt(current - target) + '자 초과했습니다. (' + fmt(current) + ' / ' + fmt(target) + '자)';
      targetStatus.className = 'target-status over';
      targetBar.className = 'progress-bar over';
    } else {
      targetStatus.textContent = fmt(target - current) + '자 더 쓸 수 있습니다. (' + fmt(current) + ' / ' + fmt(target) + '자)';
      targetStatus.className = 'target-status ok';
      targetBar.className = 'progress-bar';
    }
  }

  function update() {
    var r = window.CharCount.countText(input.value);
    if (r.overLimit) {
      elNote.textContent = '입력이 너무 깁니다. ' + fmt(window.CharCount.LIMITS.MAX_CHARS) + '자까지 셀 수 있습니다.';
      elWith.textContent = '-';
      elWithout.textContent = '-';
      elWords.textContent = '-';
      elBytes.textContent = '-';
      return;
    }
    elNote.textContent = '';
    elWith.textContent = fmt(r.charsWithSpace);
    elWithout.textContent = fmt(r.charsWithoutSpace);
    elWords.textContent = fmt(r.words);
    elBytes.textContent = fmt(r.bytesUtf8);
    updateTarget(r);
    if (!fired && r.charsWithSpace > 0 && typeof gtag === 'function') {
      fired = true;
      gtag('event', 'tool_use', { tool: 'char-count' });
    }
  }

  input.addEventListener('input', update);
  targetInput.addEventListener('input', update);
  targetBasis.addEventListener('change', update);
  document.getElementById('clear-btn').addEventListener('click', function () {
    input.value = '';
    elFeedback.textContent = '';
    update();
    input.focus();
  });
  document.getElementById('strip-spaces-btn').addEventListener('click', function () {
    input.value = input.value.replace(/\s/g, '');
    elFeedback.textContent = '공백을 모두 제거했습니다.';
    update();
    input.focus();
  });
  document.getElementById('strip-lines-btn').addEventListener('click', function () {
    input.value = input.value.replace(/\r\n|\r|\n/g, '');
    elFeedback.textContent = '줄바꿈을 제거했습니다.';
    update();
    input.focus();
  });
  document.getElementById('copy-btn').addEventListener('click', function () {
    function done() {
      elFeedback.textContent = '복사했습니다.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).then(done, function () {
        elFeedback.textContent = '복사에 실패했습니다. 직접 선택해 복사해 주세요.';
      });
    } else {
      input.select();
      try {
        document.execCommand('copy');
        done();
      } catch (e) {
        elFeedback.textContent = '복사에 실패했습니다. 직접 선택해 복사해 주세요.';
      }
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
  update();
})();
