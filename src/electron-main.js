// Modules to control application life and create native browser window
const {app, BrowserWindow, shell, ipcMain, nativeImage, Menu} = require('electron')
const path = require('path')
const fs = require('fs')

// Get arguments passed to app
if (app.isPackaged) {
	var argv = require('minimist')(process.argv.slice(1));
} else {
	var argv = require('minimist')(process.argv.slice(2));
}

if (argv["help"]) {
	console.log("Options:");
	console.log("  --profile {name}:  Name of alternate profile to use, allows for running multiple accounts");
	console.log("  --devtools:        Open Developer Tools");
	console.log("  --hidden:          Hide application on startup, useful for autostarting on login")
	console.log("  --help:            Show this help page");
	app.exit();
}

let userDataPath = app.getPath('userData');
if (argv['profile']) {
	userDataPath += '-' + argv['profile'];
}
app.setPath('userData', userDataPath);

// Force all browser windows to use a sandboxed renderer.
// With this option enabled, the renderer must communicate
// via IPC to the main process in order to access node APIs.
// https://www.electronjs.org/docs/api/sandbox-option
app.enableSandbox();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
global.appQuitting = false;

// We use this to store some tiny amount of preferences specific to electron
// things like window bounds and location
const initPath  = path.join(userDataPath, "init.json")

// Set default icon and import other js files
global.defaultIcon = nativeImage.createFromPath((path.join(__dirname, '/assets/img/glowing-bear.png')));
const tray = require("./tray");
const contextmenu = require("./context-menu");
const titlemenu = require("./menu");

function createWindow () {
    let data
    // read saved state from file (e.g. window bounds)
    // don't show any errors because on initial start file is not created
    // (makes output ugly and error is useless and confusing)
    try { data = JSON.parse(fs.readFileSync(initPath, 'utf8')) } catch(e) {}

  // Create the browser window.
  const bounds = (data && data.bounds) ? data.bounds : {width: 1280, height:800 }
  mainWindow = global.mainWindow = new BrowserWindow({
    title: "Glowing Bear",
    icon: global.defaultIcon,
    width: bounds.width,
    height: bounds.height,
    webPreferences: {
      preload: path.join(__dirname, 'electron-globals.js'),
      contextIsolation: false,
      nodeIntegration: false,
      spellcheck: true,
      webgl: false
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
  Menu.setApplicationMenu(titlemenu)

  // Open the DevTools.
  if (argv['devtools']) {
  	mainWindow.webContents.openDevTools()
  }

  var handleLink = (e, url) => {
    if (!url.startsWith('blob:') && !url.startsWith('file:')) {
        e.preventDefault()
        shell.openExternal(url)
    } else {
        e.preventDefault()
        return true
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

  // Hide when --hidden is passed
  // useful for autostart
  mainWindow.on('ready-to-show', () => {
  	if (!argv['hidden']) {
  		mainWindow.show();
  	} else {
  		mainWindow.hide();
  	}
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = global.mainWindow = null;
  })

  mainWindow.on('close', (e) => {
    // If we are not quitting and have a tray icon then minimize to tray
    if (!global.appQuitting && (tray.hasTray() || process.platform === 'darwin')) {
      // On Mac, closing the window just hides it
      // (this is generally how single-window Mac apps
      // behave, eg. Mail.app)
      e.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  app.on('browser-window-focus', function() {
      setTimeout(function() { mainWindow.webContents.focus() }, 0)
      setTimeout(function() { mainWindow.webContents.executeJavaScript("document.getElementById(\"sendMessage\").focus()") }, 0)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
    createWindow();
    tray.create();
    contextmenu.create();
});


// Listen for badge changes
ipcMain.on('badge', function(event, arg) {
    if (process.platform === "darwin") {
        app.dock.setBadge(String(arg));
    }
    else if (process.platform === "win32") {
        let n = parseInt(arg, 10)
        // Only show notifications with number
        if (isNaN(n)) {
            return
        }
        if (n > 0) {
            mainWindow.setOverlayIcon(__dirname + '/assets/img/favicon.ico', String(arg));
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

app.on('activate', () => {
    mainWindow.show();
});

function beforeQuit() {
    global.appQuitting = true;
    if (mainWindow) {
        mainWindow.webContents.send('before-quit');
    }
}

app.on('before-quit', beforeQuit);
app.on('before-quit-for-update', beforeQuit);

// Add window-all-closed so that Electron closed on Ctrl+Q
app.on('window-all-closed', () => {
    app.quit();
});

app.on('second-instance', (ev, commandLine, workingDirectory) => {
    // If other instance launched with --hidden then skip showing window
    if (commandLine.includes('--hidden')) return;

    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
