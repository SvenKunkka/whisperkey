'use strict';
// Startup diagnostics: checks every dependency the app needs and returns a
// structured report. main.js logs it, shows it in a dialog on problems, and
// exposes "Run Diagnostics…" in the tray.
const fs = require('fs');
const { AudioRecorder } = require('./recorder');
const { isModifierOnlyHotkey } = require('./hotkey');

// Each check -> { name, ok, detail, hint? }
async function run({ app, systemPreferences, cfg, asrRuntime, whisperBin, modelFile, ffmpegBin }) {
  const checks = [];
  const add = (name, ok, detail, hint) => checks.push({ name, ok, detail, hint });
  const runtime = asrRuntime || {
    engineLabel: 'whisper.cpp',
    binPath: whisperBin,
    modelLabel: cfg.model,
    modelPath: modelFile
  };

  // 1. ASR binary
  add(`${runtime.engineLabel} binary`, fs.existsSync(runtime.binPath),
    runtime.binPath, 'Run: npm run setup:whisper');

  // 2. model file
  add(`${runtime.engineLabel} model`, fs.existsSync(runtime.modelPath),
    runtime.modelPath, `Run: npm run setup:model  (model="${runtime.modelLabel}")`);

  // 3. ffmpeg
  add('ffmpeg', !!ffmpegBin && fs.existsSync(ffmpegBin),
    ffmpegBin || 'not found on PATH / Homebrew / bundle',
    'brew install ffmpeg, or bundle under vendor/ffmpeg');

  // 4. microphone device can be opened (device list + configured index present)
  let micOk = false, micDetail = 'ffmpeg unavailable';
  if (ffmpegBin) {
    const { audio } = await AudioRecorder.listDevices(ffmpegBin);
    const wantIdx = String(cfg.audioDevice).replace(/^:/, '');
    const found = audio.find(d => String(d.index) === wantIdx);
    micOk = audio.length > 0 && !!found;
    micDetail = audio.length
      ? `configured ${cfg.audioDevice} -> ${found ? found.name : 'NOT in device list'} | devices: ${audio.map(d => `[${d.index}]${d.name}`).join(', ')}`
      : 'no avfoundation audio devices detected';
  }
  add('Microphone device', micOk, micDetail,
    'List devices: ffmpeg -f avfoundation -list_devices true -i ""  then set audioDevice');

  // 5. Microphone permission
  let micPerm = 'unknown';
  try { micPerm = systemPreferences.getMediaAccessStatus('microphone'); } catch { /* non-mac */ }
  add('Microphone permission', micPerm === 'granted', micPerm,
    'System Settings → Privacy & Security → Microphone');

  // 6. Accessibility permission (needed to synthesize ⌘V)
  let axOk = false;
  try { axOk = systemPreferences.isTrustedAccessibilityClient(false); } catch { /* non-mac */ }
  add('Accessibility permission', axOk, axOk ? 'trusted' : 'NOT trusted',
    'System Settings → Privacy & Security → Accessibility');

  // 7. Input Monitoring — the default modifier-only hotkey uses ModifierMonitor,
  // matching the Hammerspoon polling approach, so it does not need event-tap input
  // monitoring. Non-modifier fallback listeners still need Input Monitoring.
  if (isModifierOnlyHotkey(cfg.hotkey)) {
    add('Input Monitoring', true, 'not required for default modifier-only hotkey');
  } else {
    add('Input Monitoring', null, 'cannot be queried by macOS — grant manually',
      'System Settings → Privacy & Security → Input Monitoring (needed for non-modifier fallback hotkeys)');
  }

  const hardFail = checks.some(c => c.ok === false);
  return { checks, hardFail, ts: new Date().toISOString() };
}

// Human-readable report for the log + dialog.
function format(report) {
  const sym = (ok) => (ok === true ? '✅' : ok === false ? '❌' : '⚠️ ');
  const lines = report.checks.map(c => {
    let s = `${sym(c.ok)} ${c.name}: ${c.detail}`;
    if (c.ok !== true && c.hint) s += `\n      ↳ ${c.hint}`;
    return s;
  });
  return `WhisperKey diagnostics (${report.ts})\n\n${lines.join('\n')}`;
}

module.exports = { run, format };
