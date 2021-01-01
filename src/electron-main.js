// Modules to control application life and create native browser window
const {app, BrowserWindow, shell, ipcMain} = require('electron')
const path = require('path')
const fs = require('fs')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// We use this to store some tiny amount of preferences specific to electron
// things like window bounds and location
const initPath  = "init.json"

function createWindow () {
    let data
    // read saved state from file (e.g. window bounds)
    try {
        data = JSON.parse(fs.readFileSync(initPath, 'utf8'))
    }
    catch(e) {
        console.log('Unable to read init.json: ', e)
    }
  // Create the browser window.
  const bounds = (data && data.bounds) ? data.bounds : {width: 1280, height:800 }
  mainWindow = new BrowserWindow({
    title: "Glowing Bear",
    icon: path.join(__dirname, "assets/img/glowing-bear.png"),
    width: bounds.width,
    height: bounds.height,
    webPreferences: {
      preload: path.join(__dirname, 'electron-globals.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Remember window position
  if (data && data.bounds.x && data.bounds.y) {
      mainWindow.x = data.bounds.x;
      mainWindow.y = data.bounds.y;
  }

  mainWindow.setMenu(null)
  mainWindow.setMenuBarVisibility(false)
  mainWindow.setAutoHideMenuBar(true)

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  var handleLink = (e, url) => {
    if(url != mainWindow.webContents.getURL()) {
        e.preventDefault()
        shell.openExternal(url)
    }
  }

  mainWindow.webContents.on('will-navigate', handleLink)
  mainWindow.webContents.on('new-window', handleLink)

  // Emitted when the window is closing.
  mainWindow.on('close', function () {
    let data = {
        bounds: mainWindow.getBounds()
    }
    fs.writeFileSync(initPath, JSON.stringify(data))
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  app.on('browser-window-focus', function() {
      setTimeout(function() { mainWindow.webContents.focus() }, 0)
      setTimeout(function() { mainWindow.webContents.executeJavaScript("document.getElementById(\"sendMessage\").focus()") }, 0)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
    createWindow()
})


// Listen for badge changes
ipcMain.on('badge', function(event, arg) {
    if (process.platform === "darwin") {
        app.dock.setBadge(String(arg))
    }
    else if (process.platform === "win32") {
        let n = parseInt(arg, 10)
        // Only show notifications with number
        if (isNaN(n)) {
            return
        }
        if (n > 0) {
            mainWindow.setOverlayIcon(__dirname + '/assets/img/favicon.ico', String(arg))
        } else {
            mainWindow.setOverlayIcon(null, '')
        }
    }
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
