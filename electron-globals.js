/**
 * Global functions for electron app
 */
var ipc = require('electron').ipcRenderer;

// Set app bagde
var setElectronBadge = function(value) {
    // Check ipc
    if (ipc && typeof ipc.send === 'function') {
        // Send new badge value
        ipc.send('badge', value);
    }
};

// Export global variables and functions
global.setElectronBadge = setElectronBadge;

// Let Glowing Bear know it's running as an electron app
window.is_electron = 1;
