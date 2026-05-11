const path = require('path')
const fs = require('fs/promises')
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron')

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Load...',
        click: async (item, focusedWindow) => {
          if (!focusedWindow) return
          const result = await dialog.showOpenDialog(focusedWindow, {
            title: 'Load grid',
            properties: ['openFile'],
            filters: [{ name: 'json', extensions: ['json'] }]
          })
          if (!result.canceled && result.filePaths.length > 0) {
            focusedWindow.webContents.send('selected-file', result.filePaths)
          }
        }
      },
      {
        label: 'Save...',
        click: async (item, focusedWindow) => {
          if (!focusedWindow) return
          const result = await dialog.showSaveDialog(focusedWindow, {
            title: 'Save grid',
            filters: [{ name: 'json', extensions: ['json'] }]
          })
          if (!result.canceled && result.filePath) {
            focusedWindow.webContents.send('saved-file', result.filePath)
          }
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Open dev tools',
        click: (item, focusedWindow) => {
          if (focusedWindow) focusedWindow.webContents.openDevTools()
        }
      },
      {
        label: 'Reload',
        click: (item, focusedWindow) => {
          if (focusedWindow) focusedWindow.reload()
        }
      },
      { type: 'separator' },
      { label: 'Zoom In', role: 'zoomIn' },
      { label: 'Zoom Out', role: 'zoomOut' }
    ]
  }
]

let mainWindow

function createWindow () {
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 1200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  })

  mainWindow.loadFile('index.html')

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url)
    if (target.protocol !== 'file:') event.preventDefault()
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault())
})

ipcMain.handle('show-save-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(win, {
    title: 'Save board',
    filters: [{ name: 'json', extensions: ['json'] }]
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('show-open-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    title: 'Load board',
    properties: ['openFile'],
    filters: [{ name: 'json', extensions: ['json'] }]
  })
  return (result.canceled || result.filePaths.length === 0) ? null : result.filePaths[0]
})

ipcMain.handle('save-board', async (event, filePath, data) => {
  if (typeof filePath !== 'string' || typeof data !== 'string') {
    throw new Error('Invalid arguments')
  }
  await fs.writeFile(filePath, data, 'utf8')
  return true
})

ipcMain.handle('load-board', async (event, filePath) => {
  if (typeof filePath !== 'string') throw new Error('Invalid arguments')
  return await fs.readFile(filePath, 'utf8')
})

ipcMain.handle('open-external', async (event, url) => {
  if (typeof url !== 'string') return false
  if (!/^https?:\/\//i.test(url)) return false
  await shell.openExternal(url)
  return true
})
