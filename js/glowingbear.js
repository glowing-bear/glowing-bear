(function() {
'use strict';

var weechat = angular.module('weechat', ['ngRoute', 'localStorage', 'weechatModels', 'plugins', 'IrcUtils', 'ngSanitize', 'ngWebsockets', 'ngTouch']);

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', '$store', '$timeout', '$log', 'models', 'connection', 'notifications', 'utils', function ($rootScope, $scope, $store, $timeout, $log, models, connection, notifications, utils) {

    $scope.command = '';
    $scope.themes = ['dark'];

    // From: http://stackoverflow.com/a/18539624 by StackOverflow user "plantian"
    $rootScope.countWatchers = function () {
        var q = [$rootScope], watchers = 0, scope;
        while (q.length > 0) {
            scope = q.pop();
            if (scope.$$watchers) {
                watchers += scope.$$watchers.length;
            }
            if (scope.$$childHead) {
                q.push(scope.$$childHead);
            }
            if (scope.$$nextSibling) {
                q.push(scope.$$nextSibling);
            }
        }
        $log.debug(watchers);
    };

    $scope.isinstalled = (function() {
        // Check for firefox & app installed
        if (navigator.mozApps !== undefined) {
            navigator.mozApps.getSelf().onsuccess = function _onAppReady(evt) {
                var app = evt.target.result;
                if (app) {
                    return true;
                } else {
                    return false;
                }
            };
        } else {
            return false;
        }
    }());


    // Detect page visibility attributes
    (function() {
        // Sadly, the page visibility API still has a lot of vendor prefixes
        if (typeof document.hidden !== "undefined") {  // Chrome >= 33, Firefox >= 18, Opera >= 12.10, Safari >= 7
            $scope.documentHidden = "hidden";
            $scope.documentVisibilityChange = "visibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {  // 13 <= Chrome < 33
            $scope.documentHidden = "webkitHidden";
            $scope.documentVisibilityChange = "webkitvisibilitychange";
        } else if (typeof document.mozHidden !== "undefined") {  // 10 <= Firefox < 18
            $scope.documentHidden = "mozHidden";
            $scope.documentVisibilityChange = "mozvisibilitychange";
        } else if (typeof document.msHidden !== "undefined") {  // IE >= 10
            $scope.documentHidden = "msHidden";
            $scope.documentVisibilityChange = "msvisibilitychange";
        }
    })();

    // Enable debug mode if "?debug=1" or "?debug=true" is set
    (function() {
        window.location.search.substring(1).split('&').forEach(function(f) {
            var segs = f.split('=');
            if (segs[0] === "debug" && ["true", "1"].indexOf(segs[1]) != -1) {
                $rootScope.debugMode = true;
                return;
            }
        });
    })();


    $rootScope.isWindowFocused = function() {
        if (typeof $scope.documentHidden === "undefined") {
            // Page Visibility API not supported, assume yes
            return true;
        } else {
            var isHidden = document[$scope.documentHidden];
            return !isHidden;
        }
    };

    if (typeof $scope.documentVisibilityChange !== "undefined") {
        document.addEventListener($scope.documentVisibilityChange, function() {
            if (!document[$scope.documentHidden]) {
                // We just switched back to the glowing-bear window and unread messages may have
                // accumulated in the active buffer while the window was in the background
                var buffer = models.getActiveBuffer();
                // This can also be triggered before connecting to the relay, check for null (not undefined!)
                if (buffer !== null) {
                    buffer.unread = 0;
                    buffer.notification = 0;

                    // Trigger title and favico update
                    $rootScope.$emit('notificationChanged');
                }

                // the unread badge in the bufferlist doesn't update if we don't do this
                $rootScope.$apply();
            }
        }, false);
    }


    $rootScope.$on('activeBufferChanged', function(event, unreadSum) {
        var ab = models.getActiveBuffer();

        // Discard surplus lines. This is done *before* lines are fetched because that saves us the effort of special handling for the
        // case where a buffer is opened for the first time ;)
        var minRetainUnread = ab.lines.length - unreadSum + 5;  // do not discard unread lines and keep 5 additional lines for context
        var surplusLines = ab.lines.length - (2 * $scope.lines_per_screen + 10);  // retain up to 2*(screenful + 10) + 10 lines because magic numbers
        var linesToRemove = Math.min(minRetainUnread, surplusLines);

        if (linesToRemove > 0) {
            ab.lines.splice(0, linesToRemove);  // remove the lines from the buffer
            ab.requestedLines -= linesToRemove;  // to ensure that the correct amount of lines is fetched should more be requested
            ab.lastSeen -= linesToRemove;  // adjust readmarker
            ab.allLinesFetched = false; // we just removed lines, so we don't have all of them. re-enable "fetch more lines"
        }

        $scope.bufferlines = ab.lines;
        $scope.nicklist = ab.nicklist;

        // Send a request for the nicklist if it hasn't been loaded yet
        if (!ab.nicklistRequested()) {
            connection.requestNicklist(ab.fullName, function() {
                $scope.showNicklist = $scope.updateShowNicklist();
                // Scroll after nicklist has been loaded, as it may break long lines
                $rootScope.scrollWithBuffer(true);
            });
        } else {
            // Check if we should show nicklist or not
            $scope.showNicklist = $scope.updateShowNicklist();
        }

        if (ab.requestedLines < $scope.lines_per_screen) {
            // buffer has not been loaded, but some lines may already be present if they arrived after we connected
            // try to determine how many lines to fetch
            var numLines = $scope.lines_per_screen + 10;  // that's (a screenful plus 10 lines) plus 10 lines, just to be safe
            if (unreadSum > numLines) {
                // request up to 4*(screenful + 10 lines)
                numLines = Math.min(4*numLines, unreadSum);
            }
            $scope.fetchMoreLines(numLines).then(
                // Update initial scroll position
                // Most relevant when first connecting to properly initalise
                function() {
                    $timeout(function() {
                        var bufferlines = document.getElementById("bufferlines");
                        $rootScope.originalBufferlinesPosition = bufferlines.scrollTop + bufferlines.scrollHeight;
                    });
                }
            );
        }
        notifications.updateTitle(ab);

        $rootScope.scrollWithBuffer(true);

        // If user wants to sync hotlist with weechat
        // we will send a /buffer bufferName command every time
        // the user switches a buffer. This will ensure that notifications
        // are cleared in the buffer the user switches to
        if ($scope.hotlistsync && ab.fullName) {
            connection.sendCoreCommand('/buffer ' + ab.fullName);
        }

        // Clear search term on buffer change
        $scope.search = '';

        if (!utils.isMobileUi()) {
            // This needs to happen asynchronously to prevent the enter key handler
            // of the input bar to be triggered on buffer switch via the search.
            // Otherwise its current contents would be sent to the new buffer
            setTimeout(function() {
                document.getElementById('sendMessage').focus();
            }, 0);
        }
    });

    $rootScope.favico = new Favico({animation: 'none'});

    $rootScope.$on('notificationChanged', function() {
        notifications.updateTitle();

        if ($scope.useFavico && $rootScope.favico) {
            notifications.updateFavico();
        }
    });

    $rootScope.$on('relayDisconnect', function() {
        models.reinitialize();
        $rootScope.$emit('notificationChanged');
        $scope.connectbutton = 'Connect';
    });
    $scope.connectbutton = 'Connect';

    $scope.getBuffers = models.getBuffers.bind(models);

    $scope.bufferlines = {};
    $scope.nicklist = {};

    $scope.activeBuffer = models.getActiveBuffer;

    $rootScope.connected = false;
    $rootScope.waseverconnected = false;

    $rootScope.models = models;

    $rootScope.iterCandidate = null;

    $store.bind($scope, "host", "localhost");
    $store.bind($scope, "port", "9001");
    $store.bind($scope, "proto", "weechat");
    $store.bind($scope, "ssl", (window.location.protocol === "https:"));
    $store.bind($scope, "savepassword", false);
    if ($scope.savepassword) {
        $store.bind($scope, "password", "");
    }
    $store.bind($scope, "autoconnect", false);

    // If we are on mobile change some defaults
    // We use 968 px as the cutoff, which should match the value in glowingbear.css
    var nonicklist = false;
    var noembed = false;
    var showtimestamp = true;

    $rootScope.wasMobileUi = false;

    if (utils.isMobileUi()) {
        nonicklist = true;
        noembed = true;
        $rootScope.wasMobileUi = true;
    }


    // Save setting for displaying only buffers with unread messages
    $store.bind($scope, "onlyUnread", false);

    // Save setting for syncing hotlist
    $store.bind($scope, "hotlistsync", true);
    // Save setting for displaying nicklist
    $store.bind($scope, "nonicklist", nonicklist);
    // Save setting for displaying embeds
    $store.bind($scope, "noembed", noembed);
    // Save setting for channel ordering
    $store.bind($scope, "orderbyserver", true);
    // Save setting for updating favicon
    $store.bind($scope, "useFavico", true);
    // Save setting for showtimestamp
    $store.bind($scope, "showtimestamp", showtimestamp);
    // Save setting for showing seconds on timestamps
    $store.bind($scope, "showtimestampSeconds", false);
    // Save setting for playing sound on notification
    $store.bind($scope, "soundnotification", false);
    // Save setting for font family
    $store.bind($scope, "fontfamily");
    // Save setting for theme
    $store.bind($scope, "theme", 'dark');
    // Save setting for font size
    $store.bind($scope, "fontsize", "14px");
    // Save setting for readline keybindings
    $store.bind($scope, "readlineBindings", false);

    if (!$scope.fontfamily) {
        if (utils.isMobileUi()) {
            $scope.fontfamily = 'sans-serif';
        } else {
            $scope.fontfamily = "Inconsolata, Consolas, Monaco, Ubuntu Mono, monospace";
        }
    }

    // Save setting for displaying embeds in rootScope so it can be used from service
    $rootScope.auto_display_embedded_content = $scope.noembed === false;

    $scope.isSidebarVisible = function() {
        return document.getElementById('sidebar').getAttribute('sidebar-state') === 'visible';
    };

    $scope.showSidebar = function() {
        document.getElementById('sidebar').setAttribute('data-state', 'visible');
        document.getElementById('content').setAttribute('sidebar-state', 'visible');
        if (utils.isMobileUi()) {
            // de-focus the input bar when opening the sidebar on mobile, so that the keyboard goes down
            _.each(document.getElementsByTagName('textarea'), function(elem) {
                elem.blur();
            });
        }
    };

    $rootScope.hideSidebar = function() {
        if (utils.isMobileUi()) {
            document.getElementById('sidebar').setAttribute('data-state', 'hidden');
            document.getElementById('content').setAttribute('sidebar-state', 'hidden');
        }
    };
    // This also fires on page load
    $scope.$watch('autoconnect', function() {
        if ($scope.autoconnect && !$rootScope.connected && !$rootScope.sslError && !$rootScope.securityError && !$rootScope.errorMessage) {
            $scope.connect();
        }
    });

    // toggle sidebar (if on mobile)
    $scope.toggleSidebar = function() {
        if (utils.isMobileUi()) {
            if ($scope.isSidebarVisible()) {
                $scope.hideSidebar();
            } else {
                $scope.showSidebar();
            }
        }
    };

    // Open and close panels while on mobile devices through swiping
    $scope.openNick = function() {
        if (utils.isMobileUi()) {
            if ($scope.nonicklist) {
                $scope.nonicklist = false;
            }
        }
    };

    $scope.closeNick = function() {
        if (utils.isMobileUi()) {
            if (!$scope.nonicklist) {
                $scope.nonicklist = true;
            }
        }
    };

    // Watch model and update show setting when it changes
    $scope.$watch('noembed', function() {
        $rootScope.auto_display_embedded_content = $scope.noembed === false;
    });
    // Watch model and update channel sorting when it changes
    $scope.$watch('orderbyserver', function() {
        $rootScope.predicate = $scope.orderbyserver ? 'serverSortKey' : 'number';
    });

    $scope.$watch('useFavico', function() {
        // this check is necessary as this is called on page load, too
        if (!$rootScope.connected) {
            return;
        }
        if ($scope.useFavico) {
            notifications.updateFavico();
        } else {
            $rootScope.favico.reset();
        }
    });

    // Update font family when changed
    $scope.$watch('fontfamily', function() {
        utils.changeClassStyle('favorite-font', 'fontFamily', $scope.fontfamily);
    });
    // Update font size when changed
    $scope.$watch('fontsize', function() {
        utils.changeClassStyle('favorite-font', 'fontSize', $scope.fontsize);
    });
    // Crude scoping hack. The keypress listener does not live in the same scope as
    // the checkbox, so we need to transfer this between scopes here.
    $scope.$watch('readlineBindings', function() {
        $rootScope.readlineBindings = $scope.readlineBindings;
    });

    $scope.setActiveBuffer = function(bufferId, key) {
        // If we are on mobile we need to collapse the menu on sidebar clicks
        // We use 968 px as the cutoff, which should match the value in glowingbear.css
        if (utils.isMobileUi()) {
            $scope.hideSidebar();
        }
        return models.setActiveBuffer(bufferId, key);
    };

    $scope.openBuffer = function(bufferName) {
        var fullName = models.getActiveBuffer().fullName;
        fullName = fullName.substring(0, fullName.lastIndexOf('.') + 1) + bufferName;  // substitute the last part

        if (!$scope.setActiveBuffer(fullName, 'fullName')) {
            var command = 'join';
            if (['#', '&', '+', '!'].indexOf(bufferName.charAt(0)) < 0) {  // these are the characters a channel name can start with (RFC 2813-2813)
                command = 'query';
            }
            connection.sendMessage('/' + command + ' ' + bufferName);
        }
    };


//XXX this does not belong here (or does it?)
    // Calculate number of lines to fetch
    $scope.calculateNumLines = function() {
        var bufferlineElements = document.querySelectorAll(".bufferline");
        var lineHeight = 0, idx = 0;
        while (lineHeight === 0 && idx < bufferlineElements.length) {
            lineHeight = bufferlineElements[idx++].clientHeight;
        }
        var areaHeight = document.querySelector("#bufferlines").clientHeight;
        // Fetch 10 lines more than theoretically needed so that scrolling up will correctly trigger the loading of more lines
        // Also, some lines might be hidden, so it's probably better to have a bit of buffer there
        var numLines = Math.ceil(areaHeight/lineHeight + 10);
        $scope.lines_per_screen = numLines;
    };
    $scope.calculateNumLines();

    // Recalculate number of lines on resize
    window.addEventListener("resize", _.debounce(function() {
        // Recalculation fails when not connected
        if ($rootScope.connected) {
            // Show the sidebar if switching away from mobile view, hide it when switching to mobile
            // Wrap in a condition so we save ourselves the $apply if nothing changes (50ms or more)
            if ($scope.wasMobileUi && !utils.isMobileUi()) {
                $scope.showSidebar();
            }
            $scope.wasMobileUi = utils.isMobileUi();
            $scope.calculateNumLines();

            // if we're scrolled to the bottom, scroll down to the same position after the resize
            // most common use case: opening the keyboard on a mobile device
            var bufferlines = document.getElementById("bufferlines");
            if ($rootScope.originalBufferlinesPosition === bufferlines.scrollHeight + bufferlines.scrollTop) {
                $timeout(function() {
                    bufferlines.scrollTop = bufferlines.scrollHeight;
                }, 100);
            }
            $rootScope.originalBufferlinesPosition = bufferlines.scrollTop + bufferlines.scrollHeight;
        }
    }, 100));


    $rootScope.loadingLines = false;
    $scope.fetchMoreLines = function(numLines) {
        if (!numLines) {
            numLines = $scope.lines_per_screen;
        }
        return connection.fetchMoreLines(numLines);
    };

    $rootScope.scrollWithBuffer = function(scrollToReadmarker, moreLines) {
        // First, get scrolling status *before* modification
        // This is required to determine where we were in the buffer pre-change
        var bl = document.getElementById('bufferlines');
        var sVal = bl.scrollHeight - bl.clientHeight;

        var scroll = function() {
            var sTop = bl.scrollTop;
            // Determine if we want to scroll at all
            // Give the check 3 pixels of slack so you don't have to hit
            // the exact spot. This fixes a bug in some browsers
            if (((scrollToReadmarker || moreLines) && sTop < sVal) || (Math.abs(sTop - sVal) < 3)) {
                var readmarker = document.querySelector(".readmarker");
                if (scrollToReadmarker && readmarker) {
                    // Switching channels, scroll to read marker
                    bl.scrollTop = readmarker.offsetTop - readmarker.parentElement.scrollHeight + readmarker.scrollHeight;
                } else if (moreLines) {
                    // We fetched more lines but the read marker is still out of view
                    // Keep the scroll position constant
                    bl.scrollTop = bl.scrollHeight - bl.clientHeight - sVal;
                } else {
                    // New message, scroll with buffer (i.e. to bottom)
                    bl.scrollTop = bl.scrollHeight - bl.clientHeight;
                }
            }
        };
        // Here be scrolling dragons
        $timeout(scroll);
        $timeout(scroll, 100);
        $timeout(scroll, 300);
        $timeout(scroll, 500);
    };


    $scope.connect = function() {
        notifications.requestNotificationPermission();
        $rootScope.sslError = false;
        $rootScope.securityError = false;
        $rootScope.errorMessage = false;
        $scope.connectbutton = 'Connecting ...';
        connection.connect($scope.host, $scope.port, $scope.password, $scope.ssl);
    };
    $scope.disconnect = function() {
        $scope.connectbutton = 'Connect';
        connection.disconnect();
    };

//XXX this is a bit out of place here, either move up to the rest of the firefox install code or remove
    $scope.install = function() {
        if (navigator.mozApps !== undefined) {
            // Find absolute url with trailing '/' or '/index.html' removed
            var base_url = location.protocol + '//' + location.host +
                location.pathname.replace(/\/(index\.html)?$/, '');
            var request = navigator.mozApps.install(base_url + '/manifest.webapp');
            request.onsuccess = function () {
                $scope.isinstalled = true;
                // Save the App object that is returned
                var appRecord = this.result;
                // Start the app.
                appRecord.launch();
                alert('Installation successful!');
            };
            request.onerror = function () {
                // Display the error information from the DOMError object
                alert('Install failed, error: ' + this.error.name);
            };
        } else {
            alert('Sorry. Only supported in Firefox v26+');
        }
    };

    $scope.showModal = function(elementId) {
        document.getElementById(elementId).setAttribute('data-state', 'visible');
    };
    $scope.closeModal = function($event) {
        function closest(elem, selector) {
            var matchesSelector = elem.matches || elem.webkitMatchesSelector || elem.mozMatchesSelector || elem.msMatchesSelector;
            while (elem) {
                if (matchesSelector.call(elem, selector)) return elem;
                else elem = elem.parentElement;
            }
        }
        closest($event.target, '.gb-modal').setAttribute('data-state', 'hidden');
    };

    $scope.toggleAccordion = function(event) {
        event.stopPropagation();
        event.preventDefault();

        var target = event.target.parentNode.parentNode.parentNode;
        target.setAttribute('data-state', target.getAttribute('data-state') === 'active' ? 'collapsed' : 'active');

        // Hide all other siblings
        var siblings = target.parentNode.children;
        for (var childId in siblings) {
            var child = siblings[childId];
            if (child.nodeType === 1 && child !== target) {
                child.setAttribute('data-state', 'collapsed');
            }
        }
    };

//XXX what do we do with this?
    $scope.hasUnread = function(buffer) {
        // if search is set, return every buffer
        if ($scope.search && $scope.search !== "") {
            return true;
        }
        if ($scope.onlyUnread) {
            // Always show current buffer in list
            if (models.getActiveBuffer() === buffer) {
                return true;
            }
            // Always show core buffer in the list (issue #438)
            if (buffer.fullName === "core.weechat") {
                return true;
            }
            return buffer.unread > 0 || buffer.notification > 0;
        }
        return true;
    };

    // Watch model and update show setting when it changes
    $scope.$watch('nonicklist', function() {
        $scope.showNicklist = $scope.updateShowNicklist();
    });
    $scope.showNicklist = false;
    // Utility function that template can use to check if nicklist should
    // be displayed for current buffer or not
    // is called on buffer switch
    $scope.updateShowNicklist = function() {
        var ab = models.getActiveBuffer();
        if (!ab) {
            return false;
        }
        // Check if option no nicklist is set
        if ($scope.nonicklist) {
            return false;
        }
        // Check if nicklist is empty
        if (ab.isNicklistEmpty()) {
            return false;
        }
        return true;
    };

//XXX not sure whether this belongs here
    $rootScope.switchToActivityBuffer = function() {
        // Find next buffer with activity and switch to it
        var sortedBuffers = _.sortBy($scope.getBuffers(), 'number');
        var i, buffer;
        // Try to find buffer with notification
        for (i in sortedBuffers) {
            buffer = sortedBuffers[i];
            if (buffer.notification > 0) {
                $scope.setActiveBuffer(buffer.id);
                return;  // return instead of break so that the second for loop isn't executed
            }
        }
        // No notifications, find first buffer with unread lines instead
        for (i in sortedBuffers) {
            buffer = sortedBuffers[i];
            if (buffer.unread > 0) {
                $scope.setActiveBuffer(buffer.id);
                return;
            }
        }
    };
    // Helper function since the keypress handler is in a different scope
    $rootScope.toggleNicklist = function() {
        $scope.nonicklist = !$scope.nonicklist;
    };


    $scope.handleSearchBoxKey = function($event) {
        // Support different browser quirks
        var code = $event.keyCode ? $event.keyCode : $event.charCode;
        // Handle escape
        if (code === 27) {
            $event.preventDefault();
            $scope.search = '';
        } // Handle enter
        else if (code === 13) {
            $event.preventDefault();
            if ($scope.filteredBuffers.length > 0) {
                $scope.setActiveBuffer($scope.filteredBuffers[0].id);
            }
            $scope.search = '';
        }
    };

    // Prevent user from accidentally leaving the page
    window.onbeforeunload = function(event) {

        if ($scope.command !== null && $scope.command !== '') {
            event.preventDefault();
            // Chrome requires this
            // Firefox does not show the site provides message
            event.returnValue = "Any unsent input will be lost. Are you sure that you want to quit?";

        } else {
            if ($rootScope.connected) {
                $scope.disconnect();
            }
            $scope.favico.reset();
        }
    };

}]);

weechat.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.when('/', {
            templateUrl: 'index.html',
            controller: 'WeechatCtrl'
        });
    }
]);

})();
