'use strict';
// Text post-processor: turns raw whisper.cpp stdout into clean, paste-ready text.
// whisper emits bracketed non-speech tags, leading/trailing whitespace, and sometimes
// duplicated spacing. For CJK we also strip the stray ASCII spaces whisper likes to
// insert between Chinese characters, while preserving spaces around Latin words.

const NON_SPEECH = /\[(?:BLANK_AUDIO|INAUDIBLE|MUSIC|SOUND|NOISE|APPLAUSE|_[A-Z]+_|[A-Z ]+)\]/gi;

function isCJK(ch) {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x4e00 && c <= 0x9fff) ||   // CJK Unified
    (c >= 0x3400 && c <= 0x4dbf) ||   // Ext A
    (c >= 0x3000 && c <= 0x303f) ||   // CJK punctuation
    (c >= 0xff00 && c <= 0xffef)      // fullwidth
  );
}

// Remove a space only when it sits between two CJK chars.
function tightenCJK(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') {
      const prev = out[out.length - 1];
      const next = s[i + 1];
      if (prev && next && isCJK(prev) && isCJK(next)) continue;
    }
    out += ch;
  }
  return out;
}

function clean(raw) {
  if (!raw) return '';
  let t = raw.replace(NON_SPEECH, ' ');
  t = t.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).join(' ');
  t = t.replace(/[ \t]{2,}/g, ' ').trim();
  t = tightenCJK(t);
  return t;
}

module.exports = { clean };
