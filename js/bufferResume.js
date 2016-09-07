
/*
 * This file contains the service used to record the last 
 * accessed buffer and return to it when reconnecting to 
 * the relay.
 */
(function() {
'use strict';

var bufferResume = angular.module('bufferResume', []);

bufferResume.service('bufferResume', ['settings', function(settings) {
    var resumer = {};
    var key = settings.host + ":" + settings.port;

    // Hold the status that we were able to find the previously accessed buffer
    //   and reload it.  If we cannot, we'll need to know so we can load the default
    var hasResumed = false;

    // Store the current buffer as having been accessed.  We can later retrieve it and compare 
    //   we recieve info from weechat to determine if we should switch to it.
    resumer.record = function(activeBuffer) {
        var subSetting = settings.currentlyViewedBuffers;
        subSetting[key] = activeBuffer.id;
        settings.currentlyViewedBuffers = subSetting;
    };

    // See if the requested buffer information matches the last recorded access.  If so, 
    //   the handler should switch to this buffer.
    resumer.shouldResume = function(buffer) {
        var savedBuffer = settings.currentlyViewedBuffers[key];
        if (!savedBuffer) { return false; }

        if (!hasResumed) {
            if (savedBuffer === buffer.id) {
                hasResumed = true;
                return true; 
            }
            return false;
        }
    };

    // The handler will ask for this after loading all infos.  If it was unable to find a buffer
    //   it will need to know so it can pick the default buffer.
    resumer.wasAbleToResume = function() {
        return hasResumed;
    };

    // Clear out the recorded info.  Maybe we'll do this when the user chooses to disconnect?  
    resumer.reset = function() {
        hasResumed = false;
    };

    return resumer;
}]);
})();
