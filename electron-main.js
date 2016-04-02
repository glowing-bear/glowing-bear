(function() {
    'use strict';
    const electron = require('electron');
    const app = electron.app;  // Module to control application life.
    const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

    const ipcMain = require('electron').ipcMain;
    const Menu = require('menu');

    var template;

    template = [
    {
        label: 'Edit',
        submenu: [
        {
            label: 'Undo',
            accelerator: 'CmdOrCtrl+Z',
            role: 'undo'
        },
        {
            label: 'Redo',
            accelerator: 'Shift+CmdOrCtrl+Z',
            role: 'redo'
        },
        {
            type: 'separator'
        },
        {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            role: 'cut'
        },
        {
            label: 'Copy',
            accelerator: 'CmdOrCtrl+C',
            role: 'copy'
        },
        {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            role: 'paste'
        },
        {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            role: 'selectall'
        },
        ]
    },
    {
        label: 'View',
        submenu: [
        {
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click: function(item, focusedWindow) {
                if (focusedWindow)
                    focusedWindow.reload();
            }
        },
        {
            label: 'Toggle Full Screen',
            accelerator: (function() {
                if (process.platform == 'darwin')
                    return 'Ctrl+Command+F';
                else
                    return 'F11';
            })(),
            click: function(item, focusedWindow) {
                if (focusedWindow)
                    focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
            }
        },
        {
            label: 'Toggle Developer Tools',
            accelerator: (function() {
                if (process.platform == 'darwin')
                    return 'Alt+Command+I';
                else
                    return 'Ctrl+Shift+I';
            })(),
            click: function(item, focusedWindow) {
                if (focusedWindow)
                    focusedWindow.toggleDevTools();
            }
        },
        ]
    },
    {
        label: 'Window',
        role: 'window',
        submenu: [
        {
            label: 'Minimize',
            accelerator: 'CmdOrCtrl+M',
            role: 'minimize'
        },
        {
            label: 'Close',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
        },
        ]
    },
    {
        label: 'Help',
        role: 'help',
        submenu: [
        {
            label: 'Learn More',
            click: function() { require('electron').shell.openExternal('https://github.com/glowing-bear/glowing-bear'); }
        },
        ]
    },
    ];

    if (process.platform == 'darwin') {
        var name = app.getName();
        template.unshift({
            label: name,
            submenu: [
            {
                label: 'About ' + name,
                role: 'about'
            },
            {
                type: 'separator'
            },
            {
                label: 'Services',
                role: 'services',
                submenu: []
            },
            {
                type: 'separator'
            },
            {
                label: 'Hide ' + name,
                accelerator: 'Command+H',
                role: 'hide'
            },
            {
                label: 'Hide Others',
                accelerator: 'Command+Alt+H',
                role: 'hideothers'
            },
            {
                label: 'Show All',
                role: 'unhide'
            },
            {
                type: 'separator'
            },
            {
                label: 'Quit',
                accelerator: 'Command+Q',
                click: function() { app.quit(); }
            },
            ]
        });
        // Window menu.
        template[3].submenu.push(
                {
                    type: 'separator'
                },
                {
                    label: 'Bring All to Front',
                    role: 'front'
                }
                );
    }

    // Keep a global reference of the window object, if you don't, the window will
    // be closed automatically when the JavaScript object is garbage collected.
    var mainWindow = null;

    app.on('browser-window-focus', function(e, w) {
        w.webContents.executeJavaScript('setTimeout(function() { document.getElementById("glowingbear").focus(); }, 0);');
        w.webContents.executeJavaScript('setTimeout(function() { document.getElementById("glowingbear").executeJavaScript("document.getElementById(\\"sendMessage\\").focus();") }, 0);');
    });

    app.on('ready', function() {

        var menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);

        mainWindow = new BrowserWindow({width: 1280, height: 800, 'min-width': 1024, 'min-height': 600, 'autoHideMenuBar': true, 'web-security': true, 'java': false, 'icon':'file://'+__dirname + 'assets/img/favicon.png'});
        mainWindow.loadUrl('file://' + __dirname + '/electron-start.html');

        // Listen for badge changes
        ipcMain.on('badge', function(event, arg) {
            if (process.platform === "darwin") {
                app.dock.setBadge(String(arg));
            }
        });
        mainWindow.on('devtools-opened', function() {
            mainWindow.webContents.executeJavaScript("document.getElementById('glowingbear').openDevTools();");
        });

        mainWindow.on('closed', function() {
            app.quit();
        });
    });
})();
