const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

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

  // Auto-update wiring
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => send({ status: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ status: 'available', info }));
  autoUpdater.on('update-not-available', (info) => send({ status: 'none', info }));
  autoUpdater.on('download-progress', (p) => send({ status: 'downloading',
    percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond }));
  autoUpdater.on('update-downloaded', (info) => {
    send({ status: 'downloaded', info });
    setTimeout(() => { try { autoUpdater.quitAndInstall(); } catch {} }, 1200);
  });
  autoUpdater.on('error', (e) => send({ status: 'error', message: String(e && e.message || e) }));

  ipcMain.handle('update-check', async () => {
    try {
      const r = await autoUpdater.checkForUpdates();
      return { ok: true, result: r && r.updateInfo };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
  ipcMain.on('update-install', () => { try { autoUpdater.quitAndInstall(); } catch {} });

  // initial check and periodic
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(()=>{}), 60*60*1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});