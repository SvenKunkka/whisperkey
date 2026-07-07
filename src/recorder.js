'use strict';
// AudioRecorder: captures mic audio to a 16kHz mono WAV via ffmpeg's avfoundation
// input (macOS native capture device). ffmpeg is spawned on hotkey press and killed
// on release, so start/stop are effectively instant (no buffering warmup between
// takes). Output is written straight to a temp .wav that the ASR module then reads.
//
// Requires: ffmpeg on PATH (brew install ffmpeg). We keep the pipeline dead simple
// to minimize latency: raw device -> 16k mono s16 wav.
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

class AudioRecorder extends EventEmitter {
  constructor({ sampleRate = 16000, device = ':default', ffmpegPath = 'ffmpeg' } = {}) {
    super();
    this.sampleRate = sampleRate;
    this.device = device;      // avfoundation "video:audio"; ":default" = default mic
    this.ffmpegPath = ffmpegPath;
    this.proc = null;
    this.outFile = null;
    this.startedAt = 0;
  }

  isRecording() { return !!this.proc; }

  start() {
    if (this.proc) return;
    if (!this.ffmpegPath) {
      throw new Error('ffmpeg not found. Install it (brew install ffmpeg) or bundle it under vendor/ffmpeg.');
    }
    this.outFile = path.join(os.tmpdir(), `whisperkey-${Date.now()}.wav`);
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'avfoundation',
      '-i', this.device,               // e.g. ":default" -> default audio input
      '-ac', '1',                      // mono
      '-ar', String(this.sampleRate),  // 16 kHz
      '-sample_fmt', 's16',
      '-y', this.outFile
    ];
    this.startedAt = Date.now();
    this.proc = spawn(this.ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    const proc = this.proc;
    let err = '';
    this.proc.stderr.on('data', d => { err += d.toString(); });
    this.proc.on('error', e => this.emit('error', e));
    this.proc.on('close', code => {
      if (this.proc === proc) {
        this.proc = null;
        this.outFile = null;
      }
      // ffmpeg exits non-zero when killed by SIGTERM/SIGINT — that's expected on stop.
      if (code && code !== 255 && err.trim()) this.emit('warn', err.trim());
    });
    this.emit('start');
  }

  // Stop recording and resolve with { file, durationMs }.
  stop() {
    return new Promise((resolve) => {
      if (!this.proc) return resolve(null);
      const file = this.outFile;
      const durationMs = Date.now() - this.startedAt;
      const proc = this.proc;
      this.proc = null;
      proc.once('close', () => {
        const ok = file && fs.existsSync(file) && fs.statSync(file).size > 44; // >WAV header
        resolve(ok ? { file, durationMs } : null);
      });
      // 'q' asks ffmpeg to finalize the file cleanly; SIGINT as a fallback.
      try { proc.stdin.write('q'); } catch { /* ignore */ }
      setTimeout(() => { try { proc.kill('SIGINT'); } catch { /* ignore */ } }, 120);
    });
  }

  static cleanup(file) {
    if (file) fs.promises.unlink(file).catch(() => {});
  }

  // Lists avfoundation audio input devices by parsing ffmpeg's stderr.
  // Resolves { audio: [{ index, name }], raw }.
  static listDevices(ffmpegPath) {
    return new Promise((resolve) => {
      if (!ffmpegPath) return resolve({ audio: [], raw: '' });
      const p = spawn(ffmpegPath, ['-f', 'avfoundation', '-list_devices', 'true', '-i', ''],
        { stdio: ['ignore', 'ignore', 'pipe'] });
      let out = '';
      p.stderr.on('data', d => { out += d.toString(); });
      p.on('error', () => resolve({ audio: [], raw: '' }));
      p.on('close', () => {
        const audio = [];
        let inAudio = false;
        for (const line of out.split('\n')) {
          if (/AVFoundation audio devices/i.test(line)) { inAudio = true; continue; }
          if (/AVFoundation video devices/i.test(line)) { inAudio = false; continue; }
          const m = line.match(/\[(\d+)\]\s+(.*)$/);
          if (inAudio && m) audio.push({ index: Number(m[1]), name: m[2].trim() });
        }
        resolve({ audio, raw: out });
      });
    });
  }
}

module.exports = { AudioRecorder };
