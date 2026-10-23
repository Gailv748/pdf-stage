const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('PDFStageBridge', {
  minimize: () => ipcRenderer.send('win:minimize'),
  readPendingFile: () => ipcRenderer.sendSync('file:pending'),
  getPendingName: () => ipcRenderer.sendSync('file:pending-name')
});
