'use strict';
// Logger: appends timestamped lines to <userData>/whisperkey.log so users can open
// a real log from the tray when recording / transcription / paste fails.
const fs = require('fs');
const path = require('path');

let logFile = null;

function init(userDataDir) {
  logFile = path.join(userDataDir, 'whisperkey.log');
  // Trim if the log grows past ~1 MB so it never balloons.
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1_000_000) {
      const tail = fs.readFileSync(logFile, 'utf8').slice(-200_000);
      fs.writeFileSync(logFile, tail);
    }
  } catch { /* ignore */ }
  info(`--- WhisperKey started ${new Date().toISOString()} ---`);
}

function write(level, msg) {
  const line = `[${new Date().toISOString()}] ${level} ${msg}`;
  try { if (logFile) fs.appendFileSync(logFile, line + '\n'); } catch { /* ignore */ }
  (level === 'ERROR' ? console.error : console.log)(line);
}

const info = (m) => write('INFO', m);
const warn = (m) => write('WARN', m);
const error = (m) => write('ERROR', m);
const logPath = () => logFile;

module.exports = { init, info, warn, error, logPath };
