const { contextBridge, shell, ipcRenderer } = require('electron');
const pkg = require('../package.json');

const updateListeners = new Set();
ipcRenderer.on('updater', (_event, msg) => {
  for (const fn of updateListeners) {
    try { fn(msg); } catch {}
  }
});

contextBridge.exposeInMainWorld('HOST', {
  version: pkg.version,
  open: (url) => shell.openExternal(url),
  update: {
    check: () => ipcRenderer.invoke('update-check'),
    install: () => ipcRenderer.send('update-install'),
    on: (fn) => { updateListeners.add(fn); return () => updateListeners.delete(fn); }
  }
});