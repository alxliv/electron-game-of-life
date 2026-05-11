const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  saveBoard: (filePath, data) => ipcRenderer.invoke('save-board', filePath, data),
  loadBoard: (filePath) => ipcRenderer.invoke('load-board', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onSavedFile: (callback) => {
    const listener = (_event, filePath) => callback(filePath)
    ipcRenderer.on('saved-file', listener)
    return () => ipcRenderer.removeListener('saved-file', listener)
  },
  onSelectedFile: (callback) => {
    const listener = (_event, filePaths) => callback(filePaths)
    ipcRenderer.on('selected-file', listener)
    return () => ipcRenderer.removeListener('selected-file', listener)
  }
})
