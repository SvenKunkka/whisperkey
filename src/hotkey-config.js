'use strict';

const MODIFIER_ORDER = ['META', 'CTRL', 'ALT', 'SHIFT'];
const MODIFIER_LABELS = {
  META: '⌘',
  CTRL: '⌃',
  ALT: '⌥',
  SHIFT: '⇧',
  'LEFT META': 'Left ⌘',
  'RIGHT META': 'Right ⌘',
  'LEFT CTRL': 'Left ⌃',
  'RIGHT CTRL': 'Right ⌃',
  'LEFT ALT': 'Left ⌥',
  'RIGHT ALT': 'Right ⌥',
  'LEFT OPTION': 'Left ⌥',
  'RIGHT OPTION': 'Right ⌥',
  'LEFT SHIFT': 'Left ⇧',
  'RIGHT SHIFT': 'Right ⇧'
};

const KEY_ALIASES = {
  ' ': 'SPACE',
  ESCAPE: 'ESC',
  ARROWUP: 'UP',
  ARROWDOWN: 'DOWN',
  ARROWLEFT: 'LEFT',
  ARROWRIGHT: 'RIGHT',
  'LEFT OPTION': 'LEFT ALT',
  'RIGHT OPTION': 'RIGHT ALT',
  CONTROL: 'CTRL',
  COMMAND: 'META',
  OPTION: 'ALT'
};

const CODE_ALIASES = {
  Space: 'SPACE',
  Escape: 'ESC',
  Enter: 'ENTER',
  Return: 'RETURN',
  Tab: 'TAB',
  Backspace: 'BACKSPACE',
  Delete: 'DELETE',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT'
};

const DISPLAY_LABELS = {
  SPACE: 'Space',
  ENTER: 'Enter',
  RETURN: 'Return',
  TAB: 'Tab',
  ESC: 'Esc',
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→'
};

function tokenFromKey(key) {
  const raw = String(key || '').trim();
  if (!raw) return '';
  const upper = raw.length === 1 ? raw.toUpperCase() : raw.toUpperCase().replace(/\s+/g, ' ');
  return KEY_ALIASES[upper] || upper;
}

function tokenFromCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return '';
  if (raw.startsWith('Key') && raw.length === 4) return raw.slice(3).toUpperCase();
  if (raw.startsWith('Digit') && raw.length === 6) return raw.slice(5);
  if (/^F\d{1,2}$/.test(raw)) return raw;
  if (CODE_ALIASES[raw]) return CODE_ALIASES[raw];
  return '';
}

function normalizeHotkey(keys) {
  const tokens = [];
  for (const key of keys || []) {
    const token = tokenFromKey(key);
    if (token && !tokens.includes(token)) tokens.push(token);
  }
  if (!tokens.length) throw new Error('Choose at least one key.');
  return tokens;
}

function tokensFromCapture(capture) {
  const tokens = [];
  const modifiers = capture && capture.modifiers ? capture.modifiers : {};
  if (modifiers.meta) tokens.push('META');
  if (modifiers.ctrl) tokens.push('CTRL');
  if (modifiers.alt) tokens.push('ALT');
  if (modifiers.shift) tokens.push('SHIFT');

  const key = tokenFromCode(capture && capture.code) || tokenFromKey(capture && capture.key);
  if (key && !MODIFIER_ORDER.includes(key) && !tokens.includes(key)) tokens.push(key);
  return normalizeHotkey(tokens);
}

function formatHotkey(keys) {
  return normalizeHotkey(keys)
    .map(token => MODIFIER_LABELS[token] || DISPLAY_LABELS[token] || token)
    .join(' + ');
}

module.exports = {
  normalizeHotkey,
  tokensFromCapture,
  formatHotkey,
  tokenFromKey,
  tokenFromCode
};
