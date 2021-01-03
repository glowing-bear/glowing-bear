/**
 * Global functions for electron app
 */
var ipc = require('electron').ipcRenderer;

// Set app badge
var setElectronBadge = function(value) {
    // Check ipc
    if (ipc && typeof ipc.send === 'function') {
        // Send new badge value
        ipc.send('badge', value);
    }
};

// Show window on notification view
var setWindowFocus = function(value) {
    // Check ipc
    if (ipc && typeof ipc.send === 'function') {
        // Send window focus request
        ipc.send('windowfocus', value);
    }
};

// Export global variables and functions
global.setElectronBadge = setElectronBadge;
global.setWindowFocus = setWindowFocus;

// Let Glowing Bear know it's running as an electron app
window.is_electron = 1;
