// https://www.electronjs.org/docs/api/menu
// Needed for keyoard shotcuts to work

const {
    app,
    Menu
} = require('electron')

const isMac = process.platform === 'darwin'

const template = [
    // { role: 'appMenu' }
    ...(isMac ? [{
        label: app.name,
        submenu: [{
                role: 'about'
            },
            {
                type: 'separator'
            },
            {
                role: 'services',
                submenu: []
            },
            {
                type: 'separator'
            },
            {
                role: 'hide'
            },
            {
                role: 'hideothers'
            },
            {
                role: 'unhide'
            },
            {
                type: 'separator'
            },
            {
                role: 'quit'
            }
        ]
    }] : []),
    // { role: 'fileMenu' }
    {
        label: 'File',
        submenu: [
            isMac ? {
                role: 'close'
            } : {
                role: 'quit'
            }
        ]
    },
    // { role: 'editMenu' }
    {
        label: 'Edit',
        submenu: [{
                role: 'undo'
            },
            {
                role: 'redo'
            },
            {
                type: 'separator'
            },
            {
                role: 'cut'
            },
            {
                role: 'copy'
            },
            {
                role: 'paste'
            },
            ...(isMac ? [{
                    role: 'selectAll'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Speech',
                    submenu: [{
                            role: 'startSpeaking'
                        },
                        {
                            role: 'stopSpeaking'
                        }
                    ]
                }
            ] : [{
                    type: 'separator'
                },
                {
                    role: 'selectAll'
                }
            ])
        ]
    },
    // { role: 'viewMenu' }
    {
        label: 'View',
        submenu: [{
                role: 'reload'
            },
            {
                role: 'forceReload'
            },
            {
                role: 'toggleDevTools'
            },
            {
                type: 'separator'
            },
            {
                role: 'resetZoom'
            },
            {
                role: 'zoomIn'
            },
            {
                role: 'zoomOut'
            },
            {
                type: 'separator'
            },
            {
                role: 'togglefullscreen'
            }
        ]
    },
    // { role: 'windowMenu' }
    {
        label: 'Window',
        submenu: [{
                role: 'minimize'
            },
            ...(isMac ? [{
                    type: 'separator'
                },
                {
                    role: 'front'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'window'
                }
            ] : [{
                role: 'close'
            }])
        ]
    },
    {
        role: 'help',
        submenu: [{
            label: 'Learn More',
            click: async () => {
                const {
                    shell
                } = require('electron')
                await shell.openExternal('https://github.com/glowing-bear/glowing-bear/blob/master/README.md#readme')
            }
        }]
    }
]

module.exports = Menu.buildFromTemplate(template);