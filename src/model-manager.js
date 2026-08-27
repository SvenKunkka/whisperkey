'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getModelSpec, modelDownloadUrl } = require('./asr-models');

function download(url, destination) {
  const tmp = `${destination}.part`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.rmSync(tmp, { force: true });

  return new Promise((resolve, reject) => {
    const request = (currentUrl, redirects = 0) => {
      const req = https.get(currentUrl, response => {
        const status = response.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          response.resume();
          if (redirects > 8) return reject(new Error('too many redirects while downloading model'));
          return request(new URL(response.headers.location, currentUrl).toString(), redirects + 1);
        }
        if (status < 200 || status >= 300) {
          response.resume();
          return reject(new Error(`model download failed with HTTP ${status}`));
        }

        const out = fs.createWriteStream(tmp, { flags: 'wx' });
        out.on('error', reject);
        response.on('error', reject);
        out.on('finish', () => {
          out.close(() => {
            fs.renameSync(tmp, destination);
            resolve(destination);
          });
        });
        response.pipe(out);
      });
      req.on('error', reject);
    };

    request(url);
  }).catch(error => {
    fs.rmSync(tmp, { force: true });
    throw error;
  });
}

async function ensureModelAvailable({ cfg, runtime, dialog, log }) {
  if (fs.existsSync(runtime.modelPath)) return { ok: true, downloaded: false };

  const modelSpec = getModelSpec(runtime.engine, runtime.model);
  const url = modelDownloadUrl(runtime.engine, runtime.model);
  const message = `Download the ${runtime.modelLabel} speech model?`;
  const detail = [
    `WhisperKey needs ${runtime.modelLabel} (${modelSpec.size}) before it can transcribe audio.`,
    '',
    'The app installer stays small by storing models in your user data folder instead of bundling them inside the app.',
    '',
    `Destination: ${runtime.modelPath}`
  ].join('\n');

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Download Whisper Model',
    message,
    detail,
    buttons: ['Download', 'Quit'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });

  if (response !== 0) return { ok: false, downloaded: false };

  log.info(`downloading model ${runtime.modelLabel}: ${url}`);
  await download(url, runtime.modelPath);
  log.info(`model downloaded: ${runtime.modelPath}`);
  return { ok: true, downloaded: true };
}

module.exports = { ensureModelAvailable, download };
