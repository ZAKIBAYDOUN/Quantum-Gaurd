const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log').default;

app.setAppUserModelId('com.quantum.guard');
log.transports.file.level = 'info';
autoUpdater.logger = log;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  win.removeMenu?.();
  win.loadFile(path.join(__dirname, '../dapp/index.html'));
  return win;
}

app.whenReady().then(() => {
  const win = createWindow();
  const send = (payload) => { try { win.webContents.send('updater', payload); } catch {} };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => send({ status: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ status: 'available', info }));
  autoUpdater.on('update-not-available', (info) => send({ status: 'none', info }));
  autoUpdater.on('download-progress', (p) => send({ status: 'downloading',
    percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond }));
  autoUpdater.on('update-downloaded', (info) => {
  send({ status: 'downloaded', info });
  try {
    autoUpdater.quitAndInstall(false, true);
  } catch (e) {
    log?.error && log.error('quitAndInstall failed', e);
    try {
      const exe = (info && (info.downloadedFile || info.file)) || null;
      if (exe) {
        const { spawn } = require('child_process');
        const child = spawn(exe, ['/S'], { detached: true, stdio: 'ignore' });
        child.unref();
        app.exit(0);
      } else {
        send({ status: 'error', message: 'No se encontró el instalador descargado.' });
      }
    } catch (er) {
      log?.error && log.error('fallback spawn failed', er);
      send({ status: 'error', message: 'Windows bloqueó la instalación automática.' });
    }
  }
});
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (e) {
      log.error('quitAndInstall failed', e);
      send({ status: 'error', message: 'Windows bloqueó la instalación automática. Ejecuta el instalador desde el banner o reinicia la app.' });
    }
  });
  autoUpdater.on('before-quit-for-update', () => send({ status: 'installing' }));
  autoUpdater.on('error', (e) => send({ status: 'error', message: String(e && e.message || e) }));

  ipcMain.handle('update-check', async () => {
    try {
      const r = await autoUpdater.checkForUpdates();
      return { ok: true, result: r && r.updateInfo };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
  ipcMain.on('update-install', () => { try { autoUpdater.quitAndInstall(false, true); } catch (e) { log.error('manual install error', e); } });

  autoUpdater.checkForUpdatesAndNotify().catch((e) => log.warn('checkForUpdatesAndNotify', e));
  setInterval(() => autoUpdater.checkForUpdates().catch((e)=>log.warn('checkForUpdates', e)), 60*60*1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});