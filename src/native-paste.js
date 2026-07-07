'use strict';

const fs = require('fs');
const path = require('path');

function defaultAppRoot() {
  return path.resolve(__dirname, '..');
}

function resolveNativePasteModulePath({
  resourcesPath = process.resourcesPath,
  appRoot = defaultAppRoot(),
  exists = fs.existsSync
} = {}) {
  const candidates = [];
  if (resourcesPath) {
    candidates.push(path.join(
      resourcesPath,
      'app.asar.unpacked',
      'native',
      'build',
      'Release',
      'paste_key.node'
    ));
  }
  if (appRoot) {
    candidates.push(path.join(appRoot, 'native', 'build', 'Release', 'paste_key.node'));
  }

  return candidates.find(candidate => exists(candidate)) || null;
}

function loadNativePaste({
  modulePath = resolveNativePasteModulePath(),
  exists = fs.existsSync,
  loader = require
} = {}) {
  if (!modulePath || !exists(modulePath)) {
    throw new Error(`native paste helper is missing: ${modulePath || 'not found'}. Run npm run build:native-paste and rebuild the app.`);
  }

  const mod = loader(modulePath);
  if (!mod || typeof mod.paste !== 'function') {
    throw new Error(`native paste helper is invalid: ${modulePath}`);
  }
  return mod;
}

function sendPasteShortcut(options) {
  return loadNativePaste(options).paste();
}

module.exports = {
  resolveNativePasteModulePath,
  loadNativePaste,
  sendPasteShortcut
};
