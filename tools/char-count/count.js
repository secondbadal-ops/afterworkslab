// 글자수 세기 — 카운팅 로직 (확정 규칙: p2-charcount-rules-1020.md, 2026-10-20)
// 순수 함수만 여기에 둔다. 화면 조작은 page.js가 맡는다.
(function () {
  'use strict';

  var LIMITS = { MAX_CHARS: 1000000 };

  function normalize(text) {
    return String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  }

  // UTF-8 바이트 수. 브라우저에서는 TextEncoder, Node에서는 Buffer를 쓴다.
  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    return Buffer.byteLength(str, 'utf8');
  }

  // 규칙: 코드포인트 단위. 공백 포함/제외, 단어수, UTF-8 바이트를 한 번에 계산한다.
  function countText(raw) {
    var text = normalize(raw);
    var chars = Array.from(text);
    var total = chars.length;
    var noSpace = 0;
    for (var i = 0; i < chars.length; i++) {
      if (!/\s/.test(chars[i])) noSpace++;
    }
    var trimmed = text.trim();
    var words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
    return {
      charsWithSpace: total,
      charsWithoutSpace: noSpace,
      words: words,
      bytesUtf8: utf8Bytes(text),
      overLimit: total > LIMITS.MAX_CHARS
    };
  }

  var api = { LIMITS: LIMITS, normalize: normalize, countText: countText };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.CharCount = api;
  }
})();
