const path = require('path')
const electron = require('electron')
const ipc = require('electron').ipcMain
const dialog = require('electron').dialog

// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const Menu = electron.Menu

let template = [
{
  label: 'File',
  submenu: [
  {
    label: 'Load...',
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        const options = {
            title: 'Load grid',
            filters: [
                { name: 'json', extensions: ['json'] }
            ]
        }
        dialog.showOpenDialog(options, function (files) {
            if (files) focusedWindow.webContents.send('selected-file', files)
        })            
      }
    }
  },
  {
    label: 'Save...',
    click: function (item, focusedWindow) {
      if (focusedWindow) 
      {
        const options = {
            title: 'Save grid',
            filters: [
                { name: 'json', extensions: ['json'] }
            ]
        }
        dialog.showSaveDialog(options, function (filename) {
            focusedWindow.webContents.send('saved-file', filename)
        })
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
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.webContents.openDevTools();        
      }
    }
  },
  {
    label: 'Reload',
    click: function (item, focusedWindow) {
      if (focusedWindow)
        focusedWindow.reload();
    }
  },
  { 
    type: 'separator'
  },
  {
    label: 'Zoom In',
    role: 'zoomin'
  },
  {
    label: 'Zoom Out',
    role: 'zoomout'
  },  
  /*
  {
    label: 'ZOOM',
    click: function (item,focusedWindow) {
      console.log('ZOOM clicked!');
      if (focusedWindow) {
        console.log('sending zoom');
        focusedWindow.webContents.send('zoom',75);
      }
    }
  }
  */
]
}]

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1000, height: 1200})

  // and load the index.html of the app.
  let url = path.join('file://',__dirname,'index.html')
  console.log('index file at: ',url)
  mainWindow.loadURL(url)

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
})
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
}
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
}
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
ipc.on('save-dialog', function (event) {
    const options = {
        title: 'Save board',
        filters: [
            { name: 'json', extensions: ['json'] }
        ]
    }
    dialog.showSaveDialog(options, function (filename) {
        event.sender.send('saved-file', filename)
    })
})

ipc.on('open-file-dialog', function (event) {
    const options = {
        title: 'Load board',
        filters: [
            { name: 'json', extensions: ['json'] }
        ]
    }
    dialog.showOpenDialog(options, function (files) {
        if (files) event.sender.send('selected-file', files)
    })
})
