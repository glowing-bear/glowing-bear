/*
Copyright 2017 Karl Glatz <karl@glatz.biz>
Copyright 2017 OpenMarket Ltd
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const {
    app,
    Tray,
    Menu,
    nativeImage
} = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;

exports.hasTray = function hasTray() {
    return (tray !== null);
};

exports.destroy = function() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
};

exports.create = function() {
    // no trays on darwin
    if (process.platform === 'darwin' || tray) return;

    const toggleWin = function() {
        if (global.mainWindow.isVisible() && !global.mainWindow.isMinimized()) {
            global.mainWindow.hide();
        } else {
            if (global.mainWindow.isMinimized()) global.mainWindow.restore();
            if (!global.mainWindow.isVisible()) global.mainWindow.show();
            global.mainWindow.focus();
        }
    };

    const contextMenu = Menu.buildFromTemplate([{
            label: 'Show/Hide Glowing Bear',
            click: toggleWin
        },
        {
            type: "separator"
        },
        {
            label: 'Quit',
            click: function() {
                app.quit();
            }
        },
    ]);

    tray = new Tray(global.defaultIcon);
    tray.setToolTip('Glowing Bear');
    tray.setContextMenu(contextMenu);

    let lastFavicon = null;
    global.mainWindow.webContents.on('page-favicon-updated', async function(ev, favicons) {
        if (!favicons || favicons.length <= 0 || !favicons[0].startsWith('data:')) {
            if (lastFavicon !== null) {
                global.mainWindow.setIcon(defaultIcon);
                tray.setImage(defaultIcon);
                lastFavicon = null;
            }
            return;
        }

        // No need to change, shortcut
        if (favicons[0] === lastFavicon) return;
        lastFavicon = favicons[0];

        let newFavicon = nativeImage.createFromDataURL(favicons[0]);

        tray.setImage(newFavicon);
        global.mainWindow.setIcon(newFavicon);
    });
};