'use strict';
// WhisperKey — Electron main process. Wires the 7 modules together:
//   HotkeyListener -> AudioRecorder -> WhisperEngine -> postprocess -> injector
// with StateManager driving a menu-bar tray + a borderless overlay for feedback.
const { app, Tray, Menu, BrowserWindow, screen, nativeImage, systemPreferences, shell, dialog, ipcMain } = require('electron');
const path = require('path');

const config = require('./config');
const { StateManager, STATES } = require('./state');
const { HotkeyListener, isModifierOnlyHotkey } = require('./hotkey');
const { AudioRecorder } = require('./recorder');
const { createAsrEngine } = require('./asr');
const { clean } = require('./postprocess');
const { inject } = require('./injector');
const { normalizeHotkey, formatHotkey } = require('./hotkey-config');
const paths = require('./paths');
const log = require('./logger');
const diagnostics = require('./diagnostics');
const diagnosticActions = require('./diagnostic-actions');
const { shouldWarnAboutInstallLocation } = require('./install-location');

app.commandLine.appendSwitch('disable-features', 'MediaSessionService');
if (process.platform === 'darwin' && app.dock) app.dock.hide(); // menu-bar-only app

let tray = null;
let overlay = null;
let cfg = null;
let state = null;
let hotkey = null;
let recorder = null;
let asrEngine = null;
let asrRuntime = null;
let ffmpegBin = null;
let busy = false;
let hotkeyWindow = null;

// ---- Permission deep-links -------------------------------------------------
const PANE = {
  mic: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  inputMonitoring: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'
};

// ---- Overlay ---------------------------------------------------------------
function createOverlay() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  overlay = new BrowserWindow({
    width: 220, height: 64,
    x: Math.round(width / 2 - 110), y: 80,
    frame: false, transparent: true, resizable: false, movable: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false,
    hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  overlay.setIgnoreMouseEvents(true);
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));
}

function createHotkeyWindow() {
  if (hotkeyWindow && !hotkeyWindow.isDestroyed()) {
    hotkeyWindow.focus();
    return;
  }
  hotkeyWindow = new BrowserWindow({
    width: 420, height: 270,
    title: 'Change WhisperKey Hotkey',
    resizable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  hotkeyWindow.setMenuBarVisibility(false);
  hotkeyWindow.once('ready-to-show', () => hotkeyWindow.show());
  hotkeyWindow.on('closed', () => { hotkeyWindow = null; });
  hotkeyWindow.loadFile(path.join(__dirname, '..', 'renderer', 'hotkey.html'));
}

function pushState(payload) {
  if (tray) tray.setToolTip(`WhisperKey — ${payload.state}`);
  if (!overlay || overlay.isDestroyed()) return;
  overlay.webContents.send('state', payload);
  if (payload.state === STATES.IDLE) overlay.hide();
  else if (!overlay.isVisible()) overlay.showInactive();
}

function overlayErrorMessage(error) {
  const message = error && error.message ? error.message : String(error || 'Unknown error');
  if (message.includes('Accessibility permission is not granted')) {
    return 'Enable Accessibility';
  }
  return message.slice(0, 80);
}

function wireHotkeyListener(listener) {
  listener.on('press', onPress);
  listener.on('release', onRelease);
  listener.on('ready', message => log.info('hotkey ready: ' + message));
  listener.on('info', message => log.info('hotkey: ' + message));
  listener.on('error', e => { log.error('hotkey: ' + e.message); state.flash(STATES.ERROR, `hotkey: ${e.message}`.slice(0, 80), 2600); });
}

function startHotkeyListener() {
  if (hotkey) hotkey.stop();
  hotkey = new HotkeyListener(cfg.hotkey);
  wireHotkeyListener(hotkey);
  hotkey.start();
}

function saveHotkey(tokens) {
  const next = normalizeHotkey(tokens);
  cfg = { ...cfg, hotkey: next };
  config.save(app.getPath('userData'), cfg);
  startHotkeyListener();
  buildTray();
  state.flash(STATES.DONE, `Hotkey: ${formatHotkey(next)}`, 1600);
  log.info(`hotkey changed: ${next.join(' + ')}`);
  maybeExplainCustomHotkeyPermissions(next);
  return { tokens: next, label: formatHotkey(next) };
}

function maybeExplainCustomHotkeyPermissions(tokens) {
  if (process.platform !== 'darwin') return;
  if (isModifierOnlyHotkey(tokens)) return;
  dialog.showMessageBox({
    type: 'info',
    title: 'Enable Custom Hotkey Permissions',
    message: 'This hotkey needs keyboard monitoring permission',
    detail: [
      `Your new hotkey is ${formatHotkey(tokens)}.`,
      '',
      'macOS may block non-modifier hotkeys until WhisperKey is allowed in Input Monitoring. If the hotkey still does not trigger, also allow WhisperKey in Accessibility.'
    ].join('\n'),
    buttons: ['Open Input Monitoring', 'Open Accessibility', 'Later'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  }).then(({ response }) => {
    if (response === 0) shell.openExternal(PANE.inputMonitoring);
    else if (response === 1) shell.openExternal(PANE.accessibility);
  });
}

// ---- Capture pipeline ------------------------------------------------------
async function onPress() {
  if (busy) return;
  try {
    recorder.start();
    state.set(STATES.RECORDING, 'Listening…');
    log.info('recording started');
  } catch (e) {
    log.error('press: ' + e.message);
    state.flash(STATES.ERROR, e.message, 1500);
  }
}

async function onRelease() {
  if (!recorder.isRecording() || busy) return;
  busy = true;
  const result = await recorder.stop();
  try {
    if (!result || result.durationMs < cfg.minRecordMs) {
      log.info(`discarded take (${result ? result.durationMs : 0}ms)`);
      state.set(STATES.IDLE);
      return;
    }
    state.set(STATES.TRANSCRIBING, 'Transcribing…');
    const raw = await asrEngine.transcribe(result.file);
    const text = clean(raw);
    if (!text) { log.info('transcription empty'); state.flash(STATES.DONE, '(no speech)'); return; }
    log.info(`transcribed ${text.length} chars in ${result.durationMs}ms audio`);
    await inject(text, { method: cfg.pasteMethod, restore: cfg.restoreClipboard });
    log.info('pasted ok');
    state.flash(STATES.DONE, 'Done');
  } catch (e) {
    log.error('pipeline: ' + e.message);
    state.flash(STATES.ERROR, overlayErrorMessage(e), 2600);
  } finally {
    AudioRecorder.cleanup(result && result.file);
    busy = false;
  }
}

// ---- Diagnostics -----------------------------------------------------------
async function getReport() {
  return diagnostics.run({
    app, systemPreferences, cfg,
    asrRuntime,
    ffmpegBin
  });
}

async function showDiagnostics(force) {
  const report = await getReport();
  const text = diagnostics.format(report);
  log.info('\n' + text);
  if (force || report.hardFail) {
    const buttons = diagnosticActions.diagnosticButtons(report);
    dialog.showMessageBox({
      type: report.hardFail ? 'warning' : 'info',
      title: 'WhisperKey Diagnostics',
      message: report.hardFail ? 'Some checks failed' : 'All core checks passed',
      detail: text,
      buttons,
      defaultId: 0, cancelId: buttons.length - 1, noLink: true
    }).then(({ response }) => {
      if (!report.hardFail) return;
      const action = diagnosticActions.diagnosticActionForResponse(response, report);
      if (action === 'microphone') shell.openExternal(PANE.mic);
      else if (action === 'accessibility') shell.openExternal(PANE.accessibility);
      else if (action === 'inputMonitoring') shell.openExternal(PANE.inputMonitoring);
      else if (action === 'logs') shell.openPath(log.logPath());
    });
  }
  return report;
}

// ---- Tray ------------------------------------------------------------------
function trayImage() {
  const iconPath = path.join(__dirname, '..', 'assets', 'trayTemplate.png');
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) {
    // Fallback: a small filled circle drawn from a base64 PNG so the menu bar is never blank.
    img = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAP0lEQVR4nGNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKBgFAJ6kBAG7T2xQAAAAAElFTkSuQmCC'
    );
  }
  img.setTemplateImage(true);
  return img;
}

function buildTray() {
  if (!tray) tray = new Tray(trayImage());
  const menu = Menu.buildFromTemplate([
    { label: `WhisperKey — hold ${formatHotkey(cfg.hotkey)}`, enabled: false },
    { label: `ASR: ${cfg.asrEngine}   Model: ${cfg.model}   Language: ${cfg.language}`, enabled: false },
    { type: 'separator' },
    { label: 'Change Hotkey…', click: () => createHotkeyWindow() },
    { label: 'Run Diagnostics…', click: () => showDiagnostics(true) },
    { label: 'Open Logs', click: () => shell.openPath(log.logPath()) },
    { type: 'separator' },
    { label: 'Permissions', enabled: false },
    { label: '  Microphone…', click: () => shell.openExternal(PANE.mic) },
    { label: '  Accessibility (paste)…', click: () => shell.openExternal(PANE.accessibility) },
    { label: '  Input Monitoring (hotkey)…', click: () => shell.openExternal(PANE.inputMonitoring) },
    { type: 'separator' },
    { label: 'Open Config File', click: () => shell.openPath(config.configPath(app.getPath('userData'))) },
    { type: 'separator' },
    { label: 'Quit WhisperKey', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip('WhisperKey — idle');
}

ipcMain.handle('hotkey:get', () => ({ tokens: cfg.hotkey, label: formatHotkey(cfg.hotkey) }));
ipcMain.handle('hotkey:set', (_event, tokens) => saveHotkey(tokens));
ipcMain.handle('hotkey:close', () => {
  if (hotkeyWindow && !hotkeyWindow.isDestroyed()) hotkeyWindow.close();
});

async function ensureMicPermission() {
  try {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status !== 'granted') await systemPreferences.askForMediaAccess('microphone');
  } catch { /* older macOS / non-mac */ }
}

async function warnIfRunningFromDiskImage() {
  if (!shouldWarnAboutInstallLocation({ isPackaged: app.isPackaged, executablePath: app.getPath('exe') })) {
    return false;
  }

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'Install WhisperKey First',
    message: 'Move WhisperKey to Applications before granting permissions',
    detail: [
      'WhisperKey is currently running from the mounted DMG.',
      '',
      'If you grant Accessibility or Input Monitoring now, macOS grants them to this temporary copy. The hotkey can stop working after you copy or remount the app.',
      '',
      'Drag WhisperKey.app to Applications, eject the DMG, then open WhisperKey from Applications and grant Accessibility plus Input Monitoring there.'
    ].join('\n'),
    buttons: ['Open Applications', 'Continue Anyway', 'Quit'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });

  if (response === 0) {
    await shell.openPath('/Applications');
    app.quit();
    return true;
  }
  if (response === 2) {
    app.quit();
    return true;
  }
  return false;
}

// ---- Boot ------------------------------------------------------------------
app.whenReady().then(async () => {
  const userData = app.getPath('userData');
  cfg = config.load(userData);
  config.save(userData, cfg); // materialize defaults on first run
  log.init(userData);

  ffmpegBin = paths.ffmpegPath(app);
  log.info(`ffmpeg: ${ffmpegBin || 'NOT FOUND'}`);

  state = new StateManager();
  state.on('change', pushState);

  recorder = new AudioRecorder({ sampleRate: cfg.sampleRate, device: cfg.audioDevice, ffmpegPath: ffmpegBin });
  recorder.on('error', e => { log.error('recorder: ' + e.message); state.flash(STATES.ERROR, `mic: ${e.message}`.slice(0, 80), 2600); });
  recorder.on('warn', w => log.warn('ffmpeg: ' + w));

  asrRuntime = paths.asrRuntime(app, cfg);
  asrEngine = createAsrEngine({
    runtime: asrRuntime,
    language: cfg.language,
    threads: cfg.threads
  });

  createOverlay();
  buildTray();
  if (await warnIfRunningFromDiskImage()) return;
  ensureMicPermission().catch(e => log.warn('microphone permission: ' + e.message));

  startHotkeyListener();

  // Startup diagnostics: log always, surface a dialog only if something's broken.
  const report = await showDiagnostics(false);
  if (report.hardFail) state.flash(STATES.ERROR, 'Setup incomplete — see dialog', 4000);
});

app.on('window-all-closed', (e) => { e.preventDefault(); }); // stay alive in tray
app.on('before-quit', () => { try { hotkey && hotkey.stop(); } catch {} });
