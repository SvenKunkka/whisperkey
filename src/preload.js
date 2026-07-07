'use strict';
// Preload: safe IPC bridge. Exposes only a state subscription to the overlay renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wk', {
  onState: (cb) => ipcRenderer.on('state', (_e, payload) => cb(payload))
});

contextBridge.exposeInMainWorld('wkHotkey', {
  get: () => ipcRenderer.invoke('hotkey:get'),
  set: (tokens) => ipcRenderer.invoke('hotkey:set', tokens),
  close: () => ipcRenderer.invoke('hotkey:close')
});
