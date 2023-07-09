'use strict';

import * as Favico from "favico.js";


import { connectionFactory } from './connection';
import { sortBy } from './misc';

/* debounce helper so we dont have to use underscore.js */
const debounce = function (func, wait, immediate) {
    var timeout;
    return function () {
        var context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        }, wait);
        if (immediate && !timeout) func.apply(context, args);
    };
};

var weechat = angular.module('weechat', ['ngRoute', 'localStorage', 'weechatModels', 'bufferResume', 'plugins', 'IrcUtils', 'ngSanitize', 'ngWebsockets', 'ngTouch'], ['$compileProvider', function($compileProvider) {
    // hacky way to be able to find out if we're in debug mode
    weechat.compileProvider = $compileProvider;
}]);
weechat.config(['$compileProvider', function ($compileProvider) {
    // hack to determine whether we're executing the tests
    if (typeof(it) === "undefined" && typeof(describe) === "undefined") {
        $compileProvider.debugInfoEnabled(false);
    }
}]);

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', '$store', '$timeout','$location', '$log', 'models', 'bufferResume', 'connection', 'notifications', 'utils', 'settings',
    function ($rootScope, $scope, $store, $timeout, $location, $log, models, bufferResume, connection, notifications, utils, settings)
{

    window.openBuffer = function(channel) {
        $scope.openBuffer(channel);
        $scope.$apply();
    };

    $scope.command = '';
    $scope.themes = ['dark', 'light', 'black', 'dark-spacious', 'blue', 'base16-default', 'base16-light', 'base16-mocha', 'base16-ocean-dark', 'base16-solarized-dark', 'base16-solarized-light'];

    // Current swipe status. Values:
    // +1: bufferlist open, nicklist closed
    //  0: bufferlist closed, nicklist closed
    // -1: bufferlist closed, nicklist open
    $scope.swipeStatus = 1;

    // Initialise all our settings, this needs to include all settings
    // or else they won't be saved to the localStorage.
    settings.setDefaults({
        'theme': 'dark',
        'hostField': 'localhost',
        'port': 9001,
        'path': 'weechat',
        'ssl': (window.location.protocol === "https:"),
        'compatibilityWeechat28': false,
        'useTotp': false,
        'savepassword': false,
        'autoconnect': false,
        'nonicklist': utils.isMobileUi(),
        'alwaysnicklist': false, // only significant on mobile
        'noembed': true,
        'onlyUnread': false,
        'hotlistsync': true,
        'orderbyserver': true,
        'useFavico': true,
        'soundnotification': true,
        'fontsize': '14px',
        'fontfamily': (utils.isMobileUi() ? 'sans-serif' : 'Inconsolata, Consolas, Monaco, Ubuntu Mono, monospace'),
        'readlineBindings': false,
        'enableMathjax': false,
        'enableQuickKeys': true,
        'customCSS': '',
        "currentlyViewedBuffers":{},
        'iToken': '',
        'iAlb': '',
        'freenodeWarningRead': '',
    });
    $scope.settings = settings;

    //For upgrade reasons because we changed the name of host to hostField
    //check if the value might still be in the host key instead of the hostField key
    if (!settings.hostField && settings.host) {
        settings.hostField = settings.host; 
    }

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

    // Show a TLS warning if GB was loaded over an unencrypted connection,
    // except for local instances (local files, testing)
    $scope.show_tls_warning = (["https:", "file:"].indexOf(window.location.protocol) === -1) &&
        (["localhost", "127.0.0.1", "::1"].indexOf(window.location.hostname) === -1);

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
                    var server = models.getServerForBuffer(buffer);
                    server.unread -= (buffer.unread + buffer.notification);
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

    $rootScope.$on('nickListChanged', function() {
            $scope.updateShowNicklist();
    });

    $rootScope.$on('activeBufferChanged', function(event, unreadSum) {
        var ab = models.getActiveBuffer();

        // Discard unread lines above 2 screenfuls. We can click through to get more if needs be
        // This is to keep GB responsive when loading buffers which have seen a lot of traffic. See issue #859
        var linesToRemove = ab.lines.length - (2 * $scope.lines_per_screen + 10);

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
                $scope.updateShowNicklist();
                // Scroll after nicklist has been loaded, as it may break long lines
                $rootScope.scrollWithBuffer(true);
            });
        } else {
            // Check if we should show nicklist or not
            $scope.updateShowNicklist();
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
                        bl.onscroll = debounce(function() {
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
        $scope.search_placeholder = 'Search';

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

    $rootScope.favico = new Favico({animation: 'none'});
    
    $scope.notifications = notifications.unreadCount('notification');
    $scope.unread = notifications.unreadCount('unread');

    $rootScope.$on('notificationChanged', function() {
        notifications.updateTitle();
        $scope.notifications = notifications.unreadCount('notification');
        $scope.unread = notifications.unreadCount('unread');

        if (settings.useFavico && $rootScope.favico) {
            notifications.updateFavico();
        }
    });

    $rootScope.$on('relayDisconnect', function() {
        // Reset title
        $rootScope.pageTitle = '';
        $rootScope.notificationStatus = '';

        // cancel outstanding notifications
        notifications.cancelAll();

        models.reinitialize();
        $rootScope.$emit('notificationChanged');
        $scope.connectbutton = 'Connect';
        $scope.connectbuttonicon = 'glyphicon-chevron-right';
        bufferResume.reset();
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

    $scope.swipeRight = function() {
        // Depending on swipe state
        if ($scope.swipeStatus === 1) {
            /* do nothing */
        } else if ($scope.swipeStatus === 0) {
            $scope.showSidebar(); // updates swipe status to 1
        } else if ($scope.swipeStatus === -1) {
            // hide nicklist
            $scope.swipeStatus = 0;
            $scope.updateShowNicklist();
        } else {
            console.log("Weird swipe status:", $scope.swipeStatus);
            $scope.swipeStatus = 0; // restore sanity
            $scope.updateShowNicklist();
            $scope.hideSidebar();
        }
    };

    $rootScope.swipeLeft = function() {
        // Depending on swipe state, ...
        if ($scope.swipeStatus === 1) {
            $scope.hideSidebar(); // updates swipe status to 0
        } else if ($scope.swipeStatus === 0) {
            // show nicklist
            $scope.swipeStatus = -1;
            if (!$scope.updateShowNicklist()) {
                $scope.swipeStatus = 0;
            }
        } else if ($scope.swipeStatus === -1) {
            /* do nothing */
        } else {
            console.log("Weird swipe status:", $scope.swipeStatus);
            $scope.swipeStatus = 0; // restore sanity
            $scope.updateShowNicklist();
            $scope.hideSidebar();
        }
    };

    $scope.showSidebar = function() {
        document.getElementById('sidebar').setAttribute('data-state', 'visible');
        document.getElementById('content').setAttribute('sidebar-state', 'visible');
        if (utils.isMobileUi()) {
            // de-focus the input bar when opening the sidebar on mobile, so that the keyboard goes down
            // TODO: this should be using get element by id, since there is other texareas
            Object.entries(document.getElementsByTagName('textarea')).forEach(function([key, elem]) {
                $timeout(function(){elem.blur();});
            });
        }
        $scope.swipeStatus = 1;
    };

    $rootScope.hideSidebar = function() {
        if (utils.isMobileUi()) {
            // make sure nicklist is hidden
            document.getElementById('sidebar').setAttribute('data-state', 'hidden');
            document.getElementById('content').setAttribute('sidebar-state', 'hidden');
        }
        $scope.swipeStatus = 0;
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

    // Watch model and update channel sorting when it changes
    var set_filter_predicate = function(orderbyserver) {
        if ($rootScope.showJumpKeys) {
            $rootScope.predicate = '$jumpKey';
        } else if (orderbyserver) {
            $rootScope.predicate = 'serverSortKey';
        } else {
            $rootScope.predicate = 'number';
        }
    };
    settings.addCallback('orderbyserver', set_filter_predicate);
    // convenience wrapper for jump keys
    $rootScope.refresh_filter_predicate = function() {
        set_filter_predicate(settings.orderbyserver);
    };

    settings.addCallback('useFavico', function(useFavico) {
        // this check is necessary as this is called on page load, too
        if (!$rootScope.connected) {
            return;
        }

        if (useFavico) {
            notifications.updateFavico();
        } else {
            $rootScope.favico.reset();
            notifications.updateBadge('');
        }
    });

    // To prevent unnecessary loading times for users who don't
    // want LaTeX math, load it only if the setting is enabled.
    // This also fires when the page is loaded if enabled.
    // Note that this says MathJax but we switched to KaTeX
    settings.addCallback('enableMathjax', function(enabled) {
        if (enabled && !$rootScope.mathjax_init) {
            // Load MathJax only once
            $rootScope.mathjax_init = true;

            utils.inject_css("https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.5.1/katex.min.css");
            utils.inject_script("https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.5.1/katex.min.js");
            utils.inject_script("https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.5.1/contrib/auto-render.min.js");
        }
    });


    // Inject theme CSS
    settings.addCallback('theme', function(theme) {
        // Unload old theme
        var oldThemeCSS = document.getElementById("themeCSS");
        if (oldThemeCSS) {
            oldThemeCSS.parentNode.removeChild(oldThemeCSS);
        }

        // Load new theme
        utils.inject_css("css/themes/" + theme + ".css", "themeCSS");
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
        if (typeof(fontsize) === "number") {
            // settings module recognizes a fontsize without unit it as a number
            // and converts, we need to convert back
            fontsize = fontsize.toString();
        }
        // If no unit is specified, it should be pixels
        if (fontsize.match(/^[0-9]+$/)) {
            fontsize += 'px';
        }
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
        if (settings.hotlistsync && models.version[0] >= 1) {
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
    window.addEventListener("resize", debounce(function() {
        // Recalculation fails when not connected
        if ($rootScope.connected) {
            // Show the sidebar if switching away from mobile view, hide it when switching to mobile
            if (!utils.isMobileUi()) {
                $scope.showSidebar();
                $scope.updateShowNicklist();
            }
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

    $scope.parseHost = function() {
        //The host field is multi purpose for advanced users
        //There can be a combination of host, port and path
        //If host is specified here the dedicated port field is disabled
        $rootScope.hostInvalid = false;

        var parts;
        var regexProto = /^(https?|wss?):\/\/(.+)$/;
        var regexHost = /^([^:\/]*|\[.*\])$/;
        var regexHostPort = /^([^:]*|\[.*\]):(\d+)$/;
        var regexHostPortPath = /^([^:]*|\[.*\]):(\d+)\/(.+)$/;

        // First, remove possible protocol info - we don't want it
        if ((parts = regexProto.exec(settings.hostField)) !== null) {
            settings.hostField = parts[2];
            if (parts[1] === "http" || parts[1] === "ws") {
                settings.ssl = false;
            } else if (parts[1] === "https" || parts[1] === "wss") {
                settings.ssl = true;
            }
        }

        if ((parts = regexHost.exec(settings.hostField)) !== null) { //host only
            settings.host = parts[1];
            settings.path = "weechat";
            $rootScope.portDisabled = false;
        } else if ((parts = regexHostPort.exec(settings.hostField)) !== null) { //host:port
            settings.host = parts[1];
            settings.port = parts[2];
            settings.path = "weechat";
            $rootScope.portDisabled = true;
        } else if ((parts = regexHostPortPath.exec(settings.hostField)) !== null) { //host:port/path
            settings.host = parts[1];
            settings.port = parts[2];
            settings.path = parts[3];
            $rootScope.portDisabled = true;
        } else {
            $rootScope.hostInvalid = true;
        }
    };

    settings.addCallback('useTotp', function() {
        if (settings.useTotp) {
            settings.autoconnect = false;
        }
    });

    $scope.parseTotp = function() {
        $scope.totpInvalid = !/^\d{4,10}$/.test($scope.totp);
    };

    $scope.parseHash = function() {

        //Fill in url parameters, they take precedence over the stored settings, but store them
        var params = {};
        $location.$$hash.split('&').map(function(val) {
            var segs = val.split('=');
            params[segs[0]] = segs[1];
        });
        if (params.host) {
            $scope.settings.host = params.host;
            $scope.settings.hostField = params.host;
        }
        if (params.port) {
            $scope.settings.port =  parseInt(params.port);
        }
        if (params.path) {
            $scope.settings.path = params.path;
            $scope.settings.hostField = $scope.settings.host + ":" + $scope.settings.port + "/" + $scope.settings.path;
        }
        if (params.password) {
            $scope.password = params.password;
        }
        if (params.autoconnect) {
            $scope.settings.autoconnect = params.autoconnect === 'true';
        }

    };

    $scope.connect = function() {
        document.getElementById('audioNotificationInitializer').play(); // Plays some silence, this will enable autoplay for notifications
        notifications.requestNotificationPermission();
        $rootScope.sslError = false;
        $rootScope.securityError = false;
        $rootScope.errorMessage = false;
        $rootScope.bufferBottom = true;
        $scope.connectbutton = 'Connecting';
        $scope.connectbuttonicon = 'glyphicon-refresh glyphicon-spin';
        connection.connect(settings.host, settings.port, settings.path, $scope.password, settings.ssl, settings.useTotp, $scope.totp);
        $scope.totp = ""; // Clear for next time
    };

    $scope.disconnect = function() {
        $scope.connectbutton = 'Connect';
        $scope.connectbuttonicon = 'glyphicon-chevron-right';
        bufferResume.reset();
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
        toggleAccordionByTarget(target);
    };

    $scope.toggleAccordionByName = function(name) {
        var target = document.getElementById(name);
        toggleAccordionByTarget(target);
    };

    var toggleAccordionByTarget = function(target) {
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
            if (buffer.fullName === "core.weechat") {
                return true;
            }

            // In hierarchical view, show server iff it has a buffer with unread messages
            if (settings.orderbyserver && buffer.type === 'server') {
                return models.getServerForBuffer(buffer).unread > 0;
            }

            // Always show pinned buffers
            if (buffer.pinned) {
                return true;
            }
            return (buffer.unread > 0 && !buffer.hidden) || buffer.notification > 0;
        }
        return !buffer.hidden;
    };

    // filter bufferlist for search or jump key
    $rootScope.bufferlistfilter = function(buffer) {
        if ($rootScope.showJumpKeys) {
            // filter by jump key
            if ($rootScope.jumpDecimal === undefined) {
                // no digit input yet, show all buffers
                return true;
            } else {
                var min_jumpKey = 10 * $rootScope.jumpDecimal,
                    max_jumpKey = 10 * ($rootScope.jumpDecimal + 1);
                return (min_jumpKey <= buffer.$jumpKey) &&
                    (buffer.$jumpKey < max_jumpKey);
            }
        } else {
            // filter by buffer name
            return buffer.fullName.toLowerCase().indexOf($scope.search.toLowerCase()) !== -1;
        }
    };

    // Watch model and update show setting when it changes
    settings.addCallback('nonicklist', function() {
        $scope.updateShowNicklist();
        // restore bottom view
        if ($rootScope.connected && $rootScope.bufferBottom) {
            $timeout(function(){
                $rootScope.updateBufferBottom(true);
            }, 500);
        }
    });
    settings.addCallback('alwaysnicklist', function() {
        $scope.updateShowNicklist();
    });
    $scope.showNicklist = false;
    // Utility function that template can use to check if nicklist should be
    // displayed for current buffer or not is called on buffer switch and
    // certain swipe actions.  Sets $scope.showNicklist accordingly and returns
    // whether the buffer even has a nicklist to show.
    $scope.updateShowNicklist = function() {
        var ab = models.getActiveBuffer();
        // Check whether buffer exists and nicklist is non-empty
        if (!ab || !ab.nicklistRequested() || ab.isNicklistEmpty()) {
            $scope.showNicklist = false;
            return false;
        }
        // Check if nicklist is disabled in settings (ignored on mobile)
        if (!utils.isMobileUi() && settings.nonicklist) {
            $scope.showNicklist = false;
            return true;
        }
        // mobile: hide nicklist unless overriden by setting or swipe action
        if (utils.isMobileUi() && !settings.alwaysnicklist && $scope.swipeStatus !== -1) {
            $scope.showNicklist = false;
            return true;
        }
        $scope.showNicklist = true;
        // hack: retrigger the favorite-font update mechanism when showing the
        // nicklist because the div is ng-if=showNicklist instead of ng-show for
        // performance reasons (especially on mobile)
        $timeout(function() {
            utils.changeClassStyle('favorite-font', 'fontFamily', settings.fontfamily);
            utils.changeClassStyle('favorite-font', 'fontSize', settings.fontsize);
        }, 0);
        return true;
    };

//XXX not sure whether this belongs here
    $rootScope.switchToActivityBuffer = function() {
        // Find next buffer with activity and switch to it
        var sortedBuffers = Object.entries($scope.getBuffers()).sort(sortBy('number'));
        // Try to find buffer with notification
        for (const [bufferid, buffer] of sortedBuffers) {
            if (buffer.notification > 0) {
                $scope.setActiveBuffer(buffer.id);
                return;  // return instead of break so that the second for loop isn't executed
            }
        }
        // No notifications, find first buffer with unread lines instead
        for (const [bufferid, buffer] of sortedBuffers) {
            if (buffer.unread > 0 && !buffer.hidden) {
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
        var sortedBuffers = Object.values($scope.getBuffers()).sort(sortBy($rootScope.predicate));
        var activeBuffer = models.getActiveBuffer();
        var index = sortedBuffers.indexOf(activeBuffer) + direction;
        var newBuffer;

        // look for next non-hidden buffer
        while (index >= 0 && index < sortedBuffers.length &&
               (!newBuffer || newBuffer.hidden)) {
            newBuffer = sortedBuffers[index];
            index += direction;
        }

        if (!!newBuffer) {
            $scope.setActiveBuffer(newBuffer.id);
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
            var index;
            $event.preventDefault();
            if ($scope.filteredBuffers.length > 0) {
                // Go to highlighted buffer if available
                // or first one
                if ($scope.search_highlight_key) {
                    index = $scope.search_highlight_key;
                } else {
                    index = 0;
                }
                $scope.setActiveBuffer($scope.filteredBuffers[index].id);
            }
            $scope.search = '';
        } // Handle arrow up
        else if (code === 38) {
            $event.preventDefault();
            if ($scope.search_highlight_key && $scope.search_highlight_key > 0) {
                $scope.search_highlight_key = $scope.search_highlight_key - 1;
            }
        } // Handle arrow down and tab
        else if (code === 40 || code === 9) {
            $event.preventDefault();
            $scope.search_highlight_key = $scope.search_highlight_key + 1;
        } // Set highlight key to zero on all other keypress
        else {
            $scope.search_highlight_key = 0;
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

    window.onhashchange = function() {
        $scope.parseHash();
    };

    $scope.init = function() {
        $scope.parseHost();
        $scope.parseHash();
    };

}]);

weechat.config(['$routeProvider', '$locationProvider',
    function($routeProvider, $locationProvider) {
        $routeProvider.when('', {
            templateUrl: 'index.html',
            controller: 'WeechatCtrl'
        });

        //remove hashbang from url
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false
        });
    }
]);

weechat.factory('connection', connectionFactory);
