(function() {
'use strict';

var weechat = angular.module('weechat', ['ngRoute', 'localStorage', 'weechatModels', 'plugins', 'IrcUtils', 'ngSanitize', 'ngWebsockets', 'ngTouch'], ['$compileProvider', function($compileProvider) {
    // hacky way to be able to find out if we're in debug mode
    weechat.compileProvider = $compileProvider;
}]);
weechat.config(['$compileProvider', function ($compileProvider) {
    // hack to determine whether we're executing the tests
    if (typeof(it) === "undefined" && typeof(describe) === "undefined") {
        $compileProvider.debugInfoEnabled(false);
    }
}]);

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', '$store', '$timeout', '$log', 'models', 'connection', 'notifications', 'utils', 'settings',
    function ($rootScope, $scope, $store, $timeout, $log, models, connection, notifications, utils, settings) {

    window.openBuffer = function(channel) {
        $scope.openBuffer(channel);
        $scope.$apply();
    };

    $scope.command = '';
    $scope.themes = ['dark', 'light', 'black'];

    // Initialise all our settings, this needs to include all settings
    // or else they won't be saved to the localStorage.
    settings.setDefaults({
        'theme': 'dark',
        'host': 'localhost',
        'port': 9001,
        'ssl': (window.location.protocol === "https:"),
        'savepassword': false,
        'autoconnect': false,
        'nonicklist': utils.isMobileUi(),
        'noembed': true,
        'onlyUnread': false,
        'hotlistsync': true,
        'orderbyserver': true,
        'useFavico': true,
        'showtimestamp': true,
        'showtimestampSeconds': false,
        'soundnotification': true,
        'fontsize': '14px',
        'fontfamily': (utils.isMobileUi() ? 'sans-serif' : 'Inconsolata, Consolas, Monaco, Ubuntu Mono, monospace'),
        'readlineBindings': false,
        'customCSS': '',
    });
    $scope.settings = settings;

    $rootScope.countWatchers = function () {
        $log.debug($rootScope.$$watchersCount);
    };

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
            }
        });
        // If we haven't reloaded yet, do an angular reload with debug infos
        // store whether this has happened yet in a GET parameter
        if ($rootScope.debugMode && !weechat.compileProvider.debugInfoEnabled()) {
            angular.reloadWithDebugInfo();
        }
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

                    // Trigger title update
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
            connection.requestNicklist(ab.id, function() {
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
                        var bl = document.getElementById("bufferlines");
                        var lastScrollHeight = bl.scrollHeight;
                        var scrollHeightObserver = function() {
                            if (bl) {
                                var newScrollHeight = bl.scrollHeight;
                                if (newScrollHeight !== lastScrollHeight) {
                                    $rootScope.updateBufferBottom($rootScope.bufferBottom);
                                    lastScrollHeight = newScrollHeight;
                                }
                                setTimeout(scrollHeightObserver, 500);
                            }
                        };
                        $rootScope.updateBufferBottom(true);
                        $rootScope.scrollWithBuffer(true);
                        bl.onscroll = _.debounce(function() {
                            $rootScope.updateBufferBottom();
                        }, 80);
                        setTimeout(scrollHeightObserver, 500);
                    });
                }
            );
        }
        notifications.updateTitle(ab);
        setTimeout(function(){
            $scope.notifications = notifications.unreadCount('notification');
            $scope.unread = notifications.unreadCount('unread');
        });

        $timeout(function() {
            $rootScope.scrollWithBuffer(true);
        });

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

        // Do this part last since it's not important for the UI
        if (settings.hotlistsync && ab.fullName) {
            connection.sendHotlistClear();
        }
    });

    $scope.notifications = notifications.unreadCount('notification');
    $scope.unread = notifications.unreadCount('unread');

    $rootScope.$on('notificationChanged', function() {
        notifications.updateTitle();
        $scope.notifications = notifications.unreadCount('notification');
        $scope.unread = notifications.unreadCount('unread');
    });

    $rootScope.$on('relayDisconnect', function() {
        // Reset title
        $rootScope.pageTitle = '';
        $rootScope.notificationStatus = '';
        notifications.cancelAll();

        models.reinitialize();
        $rootScope.$emit('notificationChanged');
        $scope.connectbutton = 'Connect';
        $scope.connectbuttonicon = 'glyphicon-chevron-right';

        // Clear all cordova notifications
        if (window.plugin !== undefined && window.plugin.notification !== undefined && window.plugin.notification.local !== undefined) {
            window.plugin.notification.local.cancelAll();
        }
    });
    $scope.connectbutton = 'Connect';
    $scope.connectbuttonicon = 'glyphicon-chevron-right';

    $scope.getBuffers = models.getBuffers.bind(models);

    $scope.bufferlines = {};
    $scope.nicklist = {};

    $scope.activeBuffer = models.getActiveBuffer;

    $rootScope.connected = false;
    $rootScope.waseverconnected = false;
    $rootScope.userdisconnect = false;
    $rootScope.reconnecting = false;

    $rootScope.models = models;

    $rootScope.iterCandidate = null;

    if (settings.savepassword) {
        $scope.$watch('password', function() {
            settings.password = $scope.password;
        });
        settings.addCallback('password', function(password) {
            $scope.password = password;
        });
        $scope.password = settings.password;
    } else {
        settings.password = '';
    }

    // Check if user decides to save password, and copy it over
    settings.addCallback('savepassword', function(newvalue) {
        if (settings.savepassword) {
            // Init value in settings module
            settings.setDefaults({'password': $scope.password});
            settings.password = $scope.password;
        }
    });

    $rootScope.wasMobileUi = false;
    if (utils.isMobileUi()) {
        $rootScope.wasMobileUi = true;
    }

    if (!settings.fontfamily) {
        if (utils.isMobileUi()) {
            settings.fontfamily = 'sans-serif';
        } else {
            settings.fontfamily = "Inconsolata, Consolas, Monaco, Ubuntu Mono, monospace";
        }
    }

    $scope.isSidebarVisible = function() {
        return document.getElementById('content').getAttribute('sidebar-state') === 'visible';
    };

    $scope.showSidebar = function() {
        document.getElementById('sidebar').setAttribute('data-state', 'visible');
        document.getElementById('content').setAttribute('sidebar-state', 'visible');
        if (utils.isMobileUi()) {
            // de-focus the input bar when opening the sidebar on mobile, so that the keyboard goes down
            _.each(document.getElementsByTagName('textarea'), function(elem) {
                $timeout(function(){elem.blur();});
            });
        }
    };

    $rootScope.hideSidebar = function() {
        if (utils.isMobileUi()) {
            document.getElementById('sidebar').setAttribute('data-state', 'hidden');
            document.getElementById('content').setAttribute('sidebar-state', 'hidden');
        }
    };
    settings.addCallback('autoconnect', function(autoconnect) {
        if (autoconnect && !$rootScope.connected && !$rootScope.sslError && !$rootScope.securityError && !$rootScope.errorMessage) {
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
            if (settings.nonicklist) {
                settings.nonicklist = false;
            }
        }
    };

    $scope.closeNick = function() {
        if (utils.isMobileUi()) {
            if (!settings.nonicklist) {
                settings.nonicklist = true;
            }
        }
    };

    // Watch model and update channel sorting when it changes
    settings.addCallback('orderbyserver', function(orderbyserver) {
        $rootScope.predicate = orderbyserver ? 'serverSortKey' : 'number';
    });


    // Inject theme CSS
    settings.addCallback('theme', function(theme) {
        // Unload old theme
        var oldThemeCSS = document.getElementById("themeCSS");
        if (oldThemeCSS) {
            oldThemeCSS.parentNode.removeChild(oldThemeCSS);
        }

        // Load new theme
        (function() {
            var elem = document.createElement("link");
            elem.rel = "stylesheet";
            elem.href = "css/themes/" + theme + ".css";
            elem.media = "screen";
            elem.id = "themeCSS";
            document.getElementsByTagName("head")[0].appendChild(elem);
        })();
    });

    settings.addCallback('customCSS', function(css) {
        // We need to delete the old tag and add a new one so that the browser
        // notices the change. Thus, first remove old custom CSS.
        var old_css = document.getElementById('custom-css-tag');
        if (old_css) {
            old_css.parentNode.removeChild(old_css);
        }

        // Create new CSS tag
        var new_css = document.createElement("style");
        new_css.type = "text/css";
        new_css.id = "custom-css-tag";
        new_css.appendChild(document.createTextNode(css));
        // Append it to the <head> tag
        var heads = document.getElementsByTagName("head");
        heads[0].appendChild(new_css);
    });


    // Update font family when changed
    settings.addCallback('fontfamily', function(fontfamily) {
        utils.changeClassStyle('favorite-font', 'fontFamily', fontfamily);
    });
    // Update font size when changed
    settings.addCallback('fontsize', function(fontsize) {
        utils.changeClassStyle('favorite-font', 'fontSize', fontsize);
    });

    $scope.setActiveBuffer = function(bufferId, key) {
        // If we are on mobile we need to collapse the menu on sidebar clicks
        // We use 968 px as the cutoff, which should match the value in glowingbear.css
        if (utils.isMobileUi()) {
            $scope.hideSidebar();
        }

        // Clear the hotlist for this buffer, because presumable you have read
        // the messages in this buffer before you switched to the new one
        // this is only needed with new type of clearing since in the old
        // way WeeChat itself takes care of that part
        if (models.version[0] >= 1) {
            connection.sendHotlistClear();
        }

        return models.setActiveBuffer(bufferId, key);
    };

    $scope.openBuffer = function(bufferName) {
        var fullName = models.getActiveBuffer().fullName;
        fullName = fullName.substring(0, fullName.lastIndexOf('.') + 1) + bufferName;  // substitute the last part

        if (!$scope.setActiveBuffer(fullName, 'fullName')) {
            // WeeChat 0.4.0+ supports /join -noswitch
            // As Glowing Bear requires 0.4.2+, we don't need to check the version
            var command = 'join -noswitch';

            // Check if it's a query and we need to use /query instead
            if (['#', '&', '+', '!'].indexOf(bufferName.charAt(0)) < 0) {  // these are the characters a channel name can start with (RFC 2813-2813)
                command = 'query';
                // WeeChat 1.2+ supports /query -noswitch. See also #577 (different context)
                if ((models.version[0] == 1 && models.version[1] >= 2) || models.version[1] > 1) {
                    command += " -noswitch";
                }
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

    // get animationframe method
    window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;

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
            if ($rootScope.bufferBottom) {
                var rescroll = function(){
                    $rootScope.updateBufferBottom(true);
                };
                $timeout(rescroll, 500);
                window.requestAnimationFrame(rescroll);
            }
        }
    }, 100));

    $rootScope.loadingLines = false;
    $scope.fetchMoreLines = function(numLines) {
        if (!numLines) {
            numLines = $scope.lines_per_screen;
        }
        return connection.fetchMoreLines(numLines);
    };

    $scope.infiniteScroll = function() {
        // Check if we are already fetching
        if ($rootScope.loadingLines) {
            return;
        }
        var buffer = models.getActiveBuffer();
        if (!buffer.allLinesFetched) {
            $scope.fetchMoreLines();
        }
    };

    $rootScope.updateBufferBottom = function(bottom) {
            var eob = document.getElementById("end-of-buffer");
            var bl = document.getElementById('bufferlines');
            if (bottom) {
                eob.scrollIntoView();
            }
            $rootScope.bufferBottom = eob.offsetTop <= bl.scrollTop + bl.clientHeight;
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
                    var eob = document.getElementById("end-of-buffer");
                    eob.scrollIntoView();
                }
                $rootScope.updateBufferBottom();
            }
        };
        // Here be scrolling dragons
        $timeout(scroll);
        window.requestAnimationFrame(scroll);
    };


    $scope.connect = function() {
        notifications.requestNotificationPermission();
        $rootScope.sslError = false;
        $rootScope.securityError = false;
        $rootScope.errorMessage = false;
        $rootScope.bufferBottom = true;
        $scope.connectbutton = 'Connecting';
        $scope.connectbuttonicon = 'glyphicon-refresh glyphicon-spin';
        connection.connect(settings.host, settings.port, $scope.password, settings.ssl);
    };
    $scope.disconnect = function() {
        $scope.connectbutton = 'Connect';
        $scope.connectbuttonicon = 'glyphicon-chevron-right';
        connection.disconnect();
    };
    $scope.reconnect = function() {
        var bufferId = models.getActiveBuffer().id;
        connection.attemptReconnect(bufferId, 3000);
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
        if (settings.onlyUnread) {
            // Always show current buffer in list
            if (models.getActiveBuffer() === buffer) {
                return true;
            }
            // Always show core buffer in the list (issue #438)
            // Also show server buffers in hierarchical view
            if (buffer.fullName === "core.weechat" || (settings.orderbyserver && buffer.type === 'server')) {
                return true;
            }
            return (buffer.unread > 0 || buffer.notification > 0) && !buffer.hidden;
        }
        return !buffer.hidden;
    };

    // Watch model and update show setting when it changes
    settings.addCallback('nonicklist', function() {
        $scope.showNicklist = $scope.updateShowNicklist();
        // restore bottom view
        if ($rootScope.connected && $rootScope.bufferBottom) {
            $timeout(function(){
                $rootScope.updateBufferBottom(true);
            }, 500);
        }
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
        if (settings.nonicklist) {
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
        settings.nonicklist = !settings.nonicklist;
    };

    $rootScope.switchToAdjacentBuffer = function(direction) {
        // direction is +1 for next buffer, -1 for previous buffer
        var sortedBuffers = _.sortBy($scope.getBuffers(), $rootScope.predicate);
        var activeBuffer = models.getActiveBuffer();
        var index = sortedBuffers.indexOf(activeBuffer);
        if (index >= 0) {
            var newBuffer = sortedBuffers[index + direction];
            if (newBuffer) {
                $scope.setActiveBuffer(newBuffer.id);
            }
        }
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

    $rootScope.supports_formatting_date = (function() {
        // function toLocaleDateStringSupportsLocales taken from MDN:
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleDateString#Checking_for_support_for_locales_and_options_arguments
        try {
            new Date().toLocaleDateString('i');
        } catch (e) {
            if (e.name !== 'RangeError') {
                $log.info("Browser does not support toLocaleDateString()," +
                          " falling back to en-US");
            }
            return e.name === 'RangeError';
        }
        $log.info("Browser does not support toLocaleDateString()," +
                  " falling back to en-US");
        return false;
    })();

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
        }
    };

    $scope.init = function() {
        if (window.location.hash) {
            var rawStr = atob(window.location.hash.substring(1));
            window.location.hash = "";
            var spl = rawStr.split(":");
            var host = spl[0];
            var port = parseInt(spl[1]);
            var password = spl[2];
            var ssl = spl.length > 3;
            notifications.requestNotificationPermission();
            $rootScope.sslError = false;
            $rootScope.securityError = false;
            $rootScope.errorMessage = false;
            $rootScope.bufferBottom = true;
            $scope.connectbutton = 'Connecting';
            $scope.connectbuttonicon = 'glyphicon-chevron-right';
            connection.connect(host, port, password, ssl);
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
