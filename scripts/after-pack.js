'use strict';

const fs = require('fs');
const path = require('path');

function chmodExecutable(file) {
  if (!fs.existsSync(file)) return;
  const mode = fs.statSync(file).mode;
  fs.chmodSync(file, mode | 0o755);
}

function appBundleDir(appOutDir) {
  if (appOutDir.endsWith('.app')) return appOutDir;
  const app = fs.readdirSync(appOutDir).find(name => name.endsWith('.app'));
  return app ? path.join(appOutDir, app) : appOutDir;
}

function ensureExecutableResources(context) {
  const resources = path.join(appBundleDir(context.appOutDir), 'Contents', 'Resources');
  for (const rel of [
    path.join('app.asar.unpacked', 'node_modules', 'node-global-key-listener', 'bin', 'MacKeyServer'),
    path.join('app.asar.unpacked', 'native', 'build', 'Release', 'paste_key.node'),
    path.join('whisper', 'whisper-cli'),
    path.join('ffmpeg', 'ffmpeg'),
    path.join('modifier-monitor', 'ModifierMonitor')
  ]) {
    chmodExecutable(path.join(resources, rel));
  }
}

module.exports = async function afterPack(context) {
  ensureExecutableResources(context);
};

module.exports.ensureExecutableResources = ensureExecutableResources;
