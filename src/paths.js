'use strict';
// Resolves the whisper binary + model paths in both dev (repo layout) and packaged
// (.app Resources) modes. In dev they live under ./vendor and ./models; when packaged
// by electron-builder they're copied into process.resourcesPath (see build.extraResources).
const path = require('path');
const fs = require('fs');
const { resolveBinary } = require('./bin');
const { getAsrEngineSpec, getModelSpec, modelFilename } = require('./asr-models');

function base(app) {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
}

function whisperBin(app) {
  const runtime = asrRuntime(app, { asrEngine: 'whisper.cpp', model: 'small' });
  return runtime.binPath;
}

function asrBinaryPath(app, engine) {
  const b = base(app);
  const spec = getAsrEngineSpec(engine);
  const dir = app.isPackaged
    ? path.join(b, spec.binaryResourceDir)
    : path.join(b, ...spec.binaryDevDir);
  const candidates = spec.binaryCandidates.map(candidate => path.join(dir, candidate));
  return candidates.find(fs.existsSync) || candidates[0];
}

function userModelDir(app) {
  if (!app.isPackaged || typeof app.getPath !== 'function') return null;
  return path.join(app.getPath('userData'), 'models');
}

function resourceModelDir(app, engine = 'whisper.cpp') {
  const b = base(app);
  const spec = getAsrEngineSpec(engine);
  return path.join(b, spec.modelResourceDir);
}

function modelSearchPaths(app, model, engine = 'whisper.cpp') {
  const filename = modelFilename(engine, model);
  const resourcePath = path.join(resourceModelDir(app, engine), filename);
  const userDir = userModelDir(app);
  if (!userDir) return [resourcePath];
  return [path.join(userDir, filename), resourcePath];
}

function modelPath(app, model, engine = 'whisper.cpp') {
  const candidates = modelSearchPaths(app, model, engine);
  return candidates.find(fs.existsSync) || candidates[0];
}

function asrRuntime(app, cfg) {
  const engine = cfg.asrEngine || 'whisper.cpp';
  const model = cfg.model || 'small';
  const engineSpec = getAsrEngineSpec(engine);
  const modelSpec = getModelSpec(engine, model);
  return {
    engine,
    engineLabel: engineSpec.label,
    binPath: asrBinaryPath(app, engine),
    model,
    modelLabel: modelSpec.label,
    modelPath: modelPath(app, model, engine)
  };
}

// Resolve ffmpeg: prefer a bundled copy under vendor/ffmpeg (dev) or
// Resources/ffmpeg (packaged), then fall back to Homebrew/system/PATH.
function ffmpegPath(app) {
  const b = base(app);
  const bundledDir = app.isPackaged ? path.join(b, 'ffmpeg') : path.join(b, 'vendor', 'ffmpeg');
  const bundled = path.join(bundledDir, 'ffmpeg');
  if (fs.existsSync(bundled)) return bundled;
  return resolveBinary('ffmpeg', { bundledDirs: [bundledDir] });
}

module.exports = {
  whisperBin,
  modelPath,
  modelSearchPaths,
  userModelDir,
  resourceModelDir,
  asrBinaryPath,
  asrRuntime,
  ffmpegPath
};
