const { contextBridge, shell } = require('electron');
const pkg = require('../package.json');
contextBridge.exposeInMainWorld('HOST', {
  version: pkg.version,
  open: (url) => shell.openExternal(url)
});
