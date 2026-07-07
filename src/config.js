'use strict';
// Config: load/save user settings from userData/config.json. All values have safe defaults.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { normalizeHotkey } = require('./hotkey-config');

const DEFAULTS = {
  // Hotkey: modifier-only hold-to-talk. ALL listed tokens must be held at once.
  // Abstract tokens match EITHER side: "META" (⌘ left or right), "SHIFT", "CTRL",
  // "ALT" (⌥). You can still pin a side ("LEFT META") or use a plain key ("F5").
  hotkey: ['META', 'SHIFT'],
  asrEngine: 'whisper.cpp',        // pluggable ASR backend; currently whisper.cpp
  model: 'small',                 // small | medium | base | tiny (must match a downloaded .bin)
  language: 'auto',               // auto | en | zh  (auto handles code-switching)
  sampleRate: 16000,
  minRecordMs: 250,               // ignore ultra-short accidental taps
  restoreClipboard: true,         // put the user's old clipboard back after paste
  audioDevice: ':0',              // avfoundation audio index. List devices with:
                                  //   ffmpeg -f avfoundation -list_devices true -i ""
  threads: Math.max(2, Math.min(8, os.cpus().length)),
  pasteMethod: 'clipboard'        // clipboard = native Cmd+V. "type" aliases clipboard for compatibility
};

function configPath(userDataDir) {
  return path.join(userDataDir, 'config.json');
}

function load(userDataDir) {
  try {
    const raw = fs.readFileSync(configPath(userDataDir), 'utf8');
    const cfg = { ...DEFAULTS, ...JSON.parse(raw) };
    cfg.hotkey = normalizeHotkey(cfg.hotkey);
    return cfg;
  } catch {
    return { ...DEFAULTS };
  }
}

function save(userDataDir, cfg) {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(configPath(userDataDir), JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('[config] save failed:', e.message);
  }
}

module.exports = { DEFAULTS, load, save, configPath };
