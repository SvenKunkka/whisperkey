'use strict';
// HotkeyListener: global hold-to-talk detection.
//
// Electron's globalShortcut only fires on a full chord press (down), never on
// release, and cannot watch modifier-only combos. We need press AND release, so
// we use node-global-key-listener, which taps the OS keyboard (macOS: Accessibility
// / Input Monitoring permission) and emits DOWN/UP for every key including modifiers.
//
// We track the live set of held keys. The moment ALL configured hotkey keys are
// held we emit 'press' (start recording). As soon as ANY of them is released we
// emit 'release' (stop + transcribe). Latency is a single event-loop tick.
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const { normalizeHotkey } = require('./hotkey-config');

// Abstract modifier families: an abstract token is satisfied by EITHER physical side.
const FAMILIES = {
  META:  ['LEFT META', 'RIGHT META'],
  SHIFT: ['LEFT SHIFT', 'RIGHT SHIFT'],
  CTRL:  ['LEFT CTRL', 'RIGHT CTRL'],
  ALT:   ['LEFT ALT', 'RIGHT ALT', 'LEFT OPTION', 'RIGHT OPTION']
};

// True if a currently-held key name satisfies a required hotkey token.
function keyMatches(heldName, token) {
  const held = String(heldName).toUpperCase();
  const tok = String(token).toUpperCase();
  if (held === tok) return true;                 // exact ("LEFT META", "F5")
  if (FAMILIES[tok]) return FAMILIES[tok].includes(held); // abstract ("META")
  return false;
}

function resolveMacKeyServerPath(resourcesPath = process.resourcesPath, exists = fs.existsSync) {
  if (process.platform !== 'darwin') return null;
  if (!resourcesPath) return null;
  const candidate = path.join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'node-global-key-listener',
    'bin',
    'MacKeyServer'
  );
  return exists(candidate) ? candidate : null;
}

function resolveModifierMonitorPath(resourcesPath = process.resourcesPath, exists = fs.existsSync) {
  if (process.platform !== 'darwin') return null;
  const bases = [];
  if (resourcesPath) bases.push(resourcesPath);
  bases.push(path.join(__dirname, '..', 'vendor'));
  for (const base of bases) {
    const candidate = path.join(base, 'modifier-monitor', 'ModifierMonitor');
    if (exists(candidate)) return candidate;
  }
  return null;
}

function isModifierOnlyHotkey(keys) {
  const normalized = (keys || []).map(k => String(k).toUpperCase());
  if (!normalized.length) return false;
  return normalized.every(token => {
    if (FAMILIES[token]) return true;
    return Object.values(FAMILIES).some(names => names.includes(token));
  });
}

class HotkeyListener extends EventEmitter {
  constructor(hotkeyKeys) {
    super();
    this.setHotkey(hotkeyKeys);
    this._down = new Set();
    this._active = false;
    this._gkl = null;
    this._monitor = null;
  }

  setHotkey(keys) {
    // Keep required tokens as-is (upper-cased); may be abstract ("META") or exact.
    this._required = normalizeHotkey(keys);
  }

  start() {
    if (this._gkl) return;
    if (this._monitor) return;
    const monitorPath = isModifierOnlyHotkey(this._required) ? resolveModifierMonitorPath() : null;
    if (monitorPath) {
      this._startModifierMonitor(monitorPath);
      return;
    }

    const macServerPath = resolveMacKeyServerPath();
    const gklConfig = macServerPath ? {
      mac: {
        serverPath: macServerPath,
        onInfo: message => this.emit('info', String(message).trim()),
        onError: code => this.emit('error', new Error(`MacKeyServer exited with code ${code}`))
      }
    } : {};
    this._gkl = new GlobalKeyboardListener(gklConfig);
    const listener = (e) => {
      const name = (e.name || '').toUpperCase();
      if (e.state === 'DOWN') this._down.add(name);
      else if (e.state === 'UP') this._down.delete(name);
      this._evaluate();
    };
    this._gkl.addListener(listener)
      .then(() => this.emit('ready', macServerPath ? `MacKeyServer: ${macServerPath}` : 'GlobalKeyboardListener'))
      .catch(error => this.emit('error', error));
  }

  _startModifierMonitor(monitorPath) {
    this._monitor = spawn(monitorPath, this._required, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.emit('ready', `ModifierMonitor: ${monitorPath}`);

    let stdout = '';
    this._monitor.stdout.on('data', chunk => {
      stdout += chunk.toString();
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop() || '';
      for (const line of lines) {
        const event = line.trim().toUpperCase();
        if (event === 'DOWN' && !this._active) {
          this._active = true;
          this.emit('press');
        } else if (event === 'UP' && this._active) {
          this._active = false;
          this.emit('release');
        }
      }
    });

    this._monitor.stderr.on('data', chunk => {
      const message = chunk.toString().trim();
      if (message) this.emit('info', message);
    });

    this._monitor.on('error', error => {
      this._monitor = null;
      this.emit('error', error);
    });

    this._monitor.on('close', code => {
      this._monitor = null;
      this._active = false;
      if (code !== 0 && code !== null) this.emit('error', new Error(`ModifierMonitor exited with code ${code}`));
    });
  }

  _allHeld() {
    if (this._required.length === 0) return false;
    const held = [...this._down];
    for (const token of this._required) {
      if (!held.some(h => keyMatches(h, token))) return false;
    }
    return true;
  }

  _evaluate() {
    const held = this._allHeld();
    if (held && !this._active) {
      this._active = true;
      this.emit('press');
    } else if (!held && this._active) {
      this._active = false;
      this.emit('release');
    }
  }

  stop() {
    if (this._gkl) { this._gkl.kill(); this._gkl = null; }
    if (this._monitor) { this._monitor.kill(); this._monitor = null; }
    this._down.clear();
    this._active = false;
  }
}

module.exports = {
  HotkeyListener,
  keyMatches,
  isModifierOnlyHotkey,
  resolveMacKeyServerPath,
  resolveModifierMonitorPath,
  FAMILIES
};
