(function() {
    'use strict';
    const electron = require('electron');
    const app = electron.app;  // Module to control application life.
    const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

    const ipcMain = require('electron').ipcMain;
    const nativeImage = require('electron').nativeImage;
    const Menu = require('electron').Menu;
    // Node fs module
    const fs = require("fs");
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
            label: 'Electron Developer Tools',
            accelerator: (function() {
                if (process.platform == 'darwin')
                    return 'Alt+Command+E';
                else
                    return 'Ctrl+Shift+E';
            })(),
            click: function(item, focusedWindow) {
                if (focusedWindow)
                    focusedWindow.toggleDevTools();
            }
        },
        {
            label: 'Web Developer Tools',
            accelerator: (function() {
                if (process.platform == 'darwin')
                    return 'Alt+Command+I';
                else
                    return 'Ctrl+Shift+I';
            })(),
            click: function(item, focusedWindow) {
                if ( focusedWindow ) {
                    focusedWindow.webContents.send( 'openDevTools' );
                }
            }
        }
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
            accelerator: 'CmdOrCtrl+Q',
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
        w.webContents.send('browser-window-focus');
    });

    app.on('ready', function() {
        var menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
        const initPath  = __dirname + "/init.json";
        var data;

        // read saved state from file (e.g. window bounds)
        try {
            data = JSON.parse(fs.readFileSync(initPath, 'utf8'));
        }
        catch(e) {
            console.log('Unable to read init.json: ', e);
        }
        const bounds = (data && data.bounds) ? data.bounds : {width: 1280, height:800 };
        var bwdata = {width: bounds.width, height: bounds.height, 'min-width': 1024, 'min-height': 600, 'autoHideMenuBar': true, 'web-security': true, 'java': false, 'accept-first-mouse': true, defaultEncoding: 'UTF-8', 'icon':'file://'+__dirname + '/assets/img/favicon.png'};
        // Remembe window position
        if (data && data.bounds.x && data.bounds.y) {
            bwdata.x = data.bounds.x;
            bwdata.y = data.bounds.y;
        }

        mainWindow = new BrowserWindow(bwdata);
        mainWindow.loadURL('file://' + __dirname + '/electron-start.html');
        mainWindow.focus();

        // Listen for badge changes
        ipcMain.on('badge', function(event, arg) {
            if (process.platform === "darwin") {
                app.dock.setBadge(String(arg));
            }
            else if (process.platform === "win32") {
                let n = parseInt(arg, 10);
                // Only show notifications with number
                if (isNaN(n)) {
                    return;
                }
                if (n > 0) {
                    mainWindow.setOverlayIcon(__dirname + '/assets/img/favicon.ico', String(arg));
                } else {
                    mainWindow.setOverlayIcon(null, '');
                }
            }
        });

        mainWindow.on('devtools-opened', function() {
            mainWindow.webContents.executeJavaScript("document.getElementById('glowingbear').openDevTools();");
        });

        mainWindow.on('close', function() {
            // Save window bounds to disk
            var data = {
                bounds: mainWindow.getBounds()
            };
            fs.writeFileSync(initPath, JSON.stringify(data));
        });

        mainWindow.on('closed', function() {
            app.quit();
        });
    });
})();
