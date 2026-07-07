'use strict';
// Resolves external binaries (ffmpeg, whisper-cli) robustly.
//
// Why this exists: a packaged macOS GUI app is launched by launchd, NOT a shell,
// so it does NOT inherit the Homebrew PATH (/opt/homebrew/bin, /usr/local/bin).
// Relying on bare "ffmpeg" works in `npm start` from a terminal but fails in a
// double-clicked .app. We therefore check bundled locations first, then the known
// Homebrew/system prefixes, then finally whatever PATH we do have.
const fs = require('fs');
const path = require('path');

const COMMON_PREFIXES = [
  '/opt/homebrew/bin',   // Apple Silicon Homebrew
  '/usr/local/bin',      // Intel Homebrew
  '/opt/local/bin',      // MacPorts
  '/usr/bin',
  '/bin'
];

function isExecFile(p) {
  try { return !!p && fs.statSync(p).isFile(); } catch { return false; }
}

// Returns absolute path to `name`, or null if not found anywhere.
function resolveBinary(name, { bundledDirs = [] } = {}) {
  const candidates = [];
  for (const d of bundledDirs) candidates.push(path.join(d, name));
  for (const d of COMMON_PREFIXES) candidates.push(path.join(d, name));
  for (const d of (process.env.PATH || '').split(':')) {
    if (d) candidates.push(path.join(d, name));
  }
  return candidates.find(isExecFile) || null;
}

module.exports = { resolveBinary, isExecFile, COMMON_PREFIXES };
