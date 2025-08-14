const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { contextIsolation: true }
  });
  win.removeMenu?.();
  win.loadFile(path.join(__dirname, "../dapp/index.html"));
}
app.whenReady().then(() => { createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
