'use strict';
// Input injector: drops transcribed text into whatever app currently has focus.
//
// Strategy = clipboard paste (works everywhere: Chrome, Safari, WeChat, Slack,
// Teams, Notion, Word, Excel...). We:
//   1. snapshot the current clipboard,
//   2. write our text,
//   3. synthesize Cmd+V from inside WhisperKey's own process,
//   4. restore the old clipboard shortly after.
//
// The paste shortcut still needs Accessibility permission, granted to WhisperKey.
const { clipboard, systemPreferences } = require('electron');
const { sendPasteShortcut } = require('./native-paste');

function assertAccessibilityPermission() {
  if (process.platform !== 'darwin') return;
  try {
    if (systemPreferences.isTrustedAccessibilityClient(false)) return;
  } catch {
    return;
  }
  throw new Error('Accessibility permission is not granted to WhisperKey. Open System Settings -> Privacy & Security -> Accessibility and enable WhisperKey.');
}

// Snapshot the common clipboard flavors so we can restore rich content, not just
// plain text. LIMITATION: Electron's clipboard API exposes text/html/rtf/image only.
// File references (NSFilenamesPboardType), custom app pasteboard types, and promised
// files are NOT captured and will be lost by the restore. For those rare cases, set
// "restoreClipboard": false and the app will simply leave the transcript on the
// clipboard instead of guessing.
function snapshotClipboard() {
  const snap = {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: clipboard.readImage()
  };
  snap.hasImage = snap.image && !snap.image.isEmpty();
  return snap;
}

function restoreClipboard(snap) {
  const data = {};
  if (snap.text) data.text = snap.text;
  if (snap.html) data.html = snap.html;
  if (snap.rtf) data.rtf = snap.rtf;
  if (snap.hasImage) data.image = snap.image;
  if (Object.keys(data).length) clipboard.write(data);
  else clipboard.clear();
}

async function pasteViaClipboard(text, { restore = true } = {}) {
  assertAccessibilityPermission();
  const prev = restore ? snapshotClipboard() : null;
  clipboard.writeText(text);
  // Small settle so the target app sees the new clipboard before Cmd+V.
  await new Promise(r => setTimeout(r, 30));
  sendPasteShortcut();
  if (restore) {
    setTimeout(() => {
      try { restoreClipboard(prev); } catch { /* ignore */ }
    }, 250);
  }
}

async function typeText(text, options) {
  return pasteViaClipboard(text, options);
}

async function inject(text, { method = 'clipboard', restore = true } = {}) {
  if (!text) return;
  if (method === 'type') return typeText(text, { restore });
  return pasteViaClipboard(text, { restore });
}

module.exports = { inject };
