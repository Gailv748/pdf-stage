const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let pendingFile = null;

/* 本地文件页面需要读取同目录的 cmaps / 字体资源 */
app.commandLine.appendSwitch('allow-file-access-from-files');

/* 允许通过命令行 / 双击关联文件的方式打开 PDF */
function extractFile(argv) {
  for (const a of argv) {
    if (!a || a.startsWith('-')) continue;
    if (/\.pdf$/i.test(a) && fs.existsSync(a)) return path.resolve(a);
  }
  return null;
}

pendingFile = extractFile(process.argv.slice(1));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    const f = extractFile(argv.slice(1));
    if (f) {
      pendingFile = f;
      if (win) {
        win.webContents.reload();
        win.show();
        win.focus();
      }
    } else if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow() {
  const iconFile = path.join(__dirname, 'icon.png');
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#3b3b3b',
    title: 'PDF 展台',
    show: false,
    autoHideMenuBar: true,
    icon: fs.existsSync(iconFile) ? iconFile : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true
    }
  });

  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------------- IPC ---------------- */
ipcMain.on('win:minimize', () => {
  if (win) win.minimize();
});

ipcMain.on('file:pending', (e) => {
  try {
    if (!pendingFile) { e.returnValue = ''; return; }
    const buf = fs.readFileSync(pendingFile);
    e.returnValue = buf.toString('base64');
  } catch (err) {
    e.returnValue = '';
  }
});

ipcMain.on('file:pending-name', (e) => {
  e.returnValue = pendingFile ? path.basename(pendingFile) : '';
});

ipcMain.handle('file:save', async (e, name, base64) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '保存文件',
    defaultPath: path.join(app.getPath('downloads'), name)
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return true;
});
