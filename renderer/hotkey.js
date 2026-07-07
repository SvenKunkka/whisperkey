'use strict';

const combo = document.getElementById('combo');
const hint = document.getElementById('hint');
const error = document.getElementById('error');
const save = document.getElementById('save');
const cancel = document.getElementById('cancel');

const MODIFIERS = {
  Meta: 'META',
  Shift: 'SHIFT',
  Control: 'CTRL',
  Alt: 'ALT',
  Option: 'ALT'
};

const KEY_ALIASES = {
  ' ': 'SPACE',
  Escape: 'ESC',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT'
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

const LABELS = {
  META: '⌘',
  CTRL: '⌃',
  ALT: '⌥',
  SHIFT: '⇧',
  SPACE: 'Space',
  ENTER: 'Enter',
  TAB: 'Tab',
  ESC: 'Esc',
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→'
};

let selected = [];

function normalizeKey(key) {
  if (MODIFIERS[key]) return MODIFIERS[key];
  if (KEY_ALIASES[key]) return KEY_ALIASES[key];
  return String(key || '').length === 1 ? key.toUpperCase() : String(key || '').toUpperCase();
}

function normalizeCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return '';
  if (raw.startsWith('Key') && raw.length === 4) return raw.slice(3).toUpperCase();
  if (raw.startsWith('Digit') && raw.length === 6) return raw.slice(5);
  if (/^F\d{1,2}$/.test(raw)) return raw;
  if (CODE_ALIASES[raw]) return CODE_ALIASES[raw];
  return '';
}

function label(tokens) {
  return tokens.map(token => LABELS[token] || token).join(' + ');
}

function render(tokens) {
  selected = tokens;
  combo.textContent = tokens.length ? label(tokens) : 'Press a key or shortcut';
  save.disabled = tokens.length === 0;
  error.textContent = '';
}

window.addEventListener('keydown', event => {
  event.preventDefault();
  const next = [];
  if (event.metaKey) next.push('META');
  if (event.ctrlKey) next.push('CTRL');
  if (event.altKey) next.push('ALT');
  if (event.shiftKey) next.push('SHIFT');
  const key = normalizeCode(event.code) || normalizeKey(event.key);
  if (key && !['META', 'CTRL', 'ALT', 'SHIFT'].includes(key) && !next.includes(key)) next.push(key);
  render(next);
});

save.addEventListener('click', async () => {
  try {
    const result = await window.wkHotkey.set(selected);
    render(result.tokens);
    await window.wkHotkey.close();
  } catch (err) {
    error.textContent = err && err.message ? err.message : 'Could not save hotkey.';
  }
});

cancel.addEventListener('click', () => window.wkHotkey.close());

window.wkHotkey.get().then(({ tokens, label: currentLabel }) => {
  render(tokens || []);
  hint.textContent = `Current: ${currentLabel || label(tokens || [])}`;
});
