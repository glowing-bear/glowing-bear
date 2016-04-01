var ipc = require('electron').ipcRenderer;

var setElectronBadge = function(value) {
    if (ipc && typeof ipc.send === 'function') {
        ipc.send('badge', value);
    }
};

global.setElectronBadge = setElectronBadge;
