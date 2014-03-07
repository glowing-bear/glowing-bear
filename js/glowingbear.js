'use strict';
var weechat = angular.module('weechat', ['ngRoute', 'localStorage', 'weechatModels', 'plugins', 'ngSanitize', 'ngWebsockets', 'pasvaz.bindonce', 'ngTouch', 'ngAnimate']);

weechat.filter('toArray', function () {
    'use strict';

    return function (obj) {
        if (!(obj instanceof Object)) {
            return obj;
        }

        return Object.keys(obj).map(function (key) {
            return Object.defineProperty(obj[key], '$key', { value: key });
        });
    };
});

weechat.filter('irclinky', ['$filter', function($filter) {
    'use strict';
    return function(text, target) {
        if (!text) {
            return text;
        }

        var linkiedText = $filter('linky')(text, target);

        // This regex in no way matches all IRC channel names (they could begin with a +, an &, or an exclamation
        // mark followed by 5 alphanumeric characters, and are bounded in length by 50).
        // However, it matches all *common* IRC channels while trying to minimise false positives. "#1" is much
        // more likely to be "number 1" than "IRC channel #1".
        // Thus, we only match channels beginning with a # and having at least one letter in them.
        var channelRegex = /(^|[\s,.:;?!"'()/\\])(#+[a-z0-9-_]*[a-z][a-z0-9-_]*)/gmi;
        // This is SUPER nasty, but ng-click does not work inside a filter, as the markup has to be $compiled first, which is not possible in filter afaik.
        // Therefore, get the scope, fire the method, and $apply. Yuck. I sincerely hope someone finds a better way of doing this.
        linkiedText = linkiedText.replace(channelRegex, '$1<a href="#" onclick="var $scope = angular.element(event.target).scope(); $scope.openBuffer(\'$2\'); $scope.$apply();">$2</a>');
        return linkiedText;
    };
}]);

weechat.factory('handlers', ['$rootScope', 'models', 'plugins', function($rootScope, models, plugins) {

    var handleBufferClosing = function(message) {
        var bufferMessage = message.objects[0].content[0];
        var buffer = new models.Buffer(bufferMessage);
        models.closeBuffer(buffer);
    };

    var handleLine = function(line, manually) {
        var message = new models.BufferLine(line);
        var buffer = models.getBuffer(message.buffer);
        buffer.requestedLines++;
        // Only react to line if its displayed
        if (message.displayed) {
            message = plugins.PluginManager.contentForMessage(message, $rootScope.visible);
            buffer.addLine(message);

            if (manually) {
                buffer.lastSeen++;
            }

            if (buffer.active && !manually) {
                $rootScope.scrollWithBuffer();
            }

            if (!manually && (!buffer.active || !$rootScope.isWindowFocused())) {
                if (buffer.notify > 1 && _.contains(message.tags, 'notify_message') && !_.contains(message.tags, 'notify_none')) {
                    buffer.unread++;
                    $rootScope.$emit('notificationChanged');
                }

                if ((buffer.notify !== 0 && message.highlight) || _.contains(message.tags, 'notify_private')) {
                    buffer.notification++;
                    $rootScope.createHighlight(buffer, message);
                    $rootScope.$emit('notificationChanged');
                }
            }
        }
    };

    var handleBufferLineAdded = function(message) {
        message.objects[0].content.forEach(function(l) {
            handleLine(l, false);
        });
    };

    var handleBufferOpened = function(message) {
        var bufferMessage = message.objects[0].content[0];
        var buffer = new models.Buffer(bufferMessage);
        models.addBuffer(buffer);
        models.setActiveBuffer(buffer.id);
    };

    var handleBufferTitleChanged = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);
        old.fullName = obj.full_name;
        old.title = obj.title;
        old.number = obj.number;
    };

    var handleBufferRenamed = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);
        old.fullName = obj.full_name;
        old.shortName = obj.short_name;
    };

    /*
     * Handle answers to (lineinfo) messages
     *
     * (lineinfo) messages are specified by this client. It is request after bufinfo completes
     */
    var handleLineInfo = function(message, manually) {
        var lines = message.objects[0].content.reverse();
        if (manually === undefined) {
            manually = true;
        }
        lines.forEach(function(l) {
            handleLine(l, manually);
        });
    };

    /*
     * Handle answers to hotlist request
     */
    var handleHotlistInfo = function(message) {
        if (message.objects.length === 0) {
            return;
        }
        var hotlist = message.objects[0].content;
        hotlist.forEach(function(l) {
            var buffer = models.getBuffer(l.buffer);
            // 1 is message
            buffer.unread += l.count[1];
            // 2 is ?
            buffer.unread += l.count[2];
            // 3 is highlight
            buffer.notification += l.count[3];
            /* Since there is unread messages, we can guess
            * what the last read line is and update it accordingly
            */
            var unreadSum = _.reduce(l.count, function(memo, num) { return memo + num; }, 0);
            buffer.lastSeen = buffer.lines.length - 1 - unreadSum;
        });
    };

    /*
     * Handle nicklist event
     */
    var handleNicklist = function(message) {
        var nicklist = message.objects[0].content;
        var group = 'root';
        nicklist.forEach(function(n) {
            var buffer = models.getBuffer(n.pointers[0]);
            if (n.group === 1) {
                var g = new models.NickGroup(n);
                group = g.name;
                buffer.nicklist[group] = g;
            } else {
                var nick = new models.Nick(n);
                buffer.addNick(group, nick);
            }
        });
    };
    /*
     * Handle nicklist diff event
     */
    var handleNicklistDiff = function(message) {
        var nicklist = message.objects[0].content;
        var group;
        nicklist.forEach(function(n) {
            var buffer = models.getBuffer(n.pointers[0]);
            var d = n._diff;
            if (n.group === 1) {
                group = n.name;
                if (group === undefined) {
                    var g = new models.NickGroup(n);
                    buffer.nicklist[group] = g;
                    group = g.name;
                }
            } else {
                var nick = new models.Nick(n);
                if (d === 43) { // +
                    buffer.addNick(group, nick);
                } else if (d === 45) { // -
                    buffer.delNick(group, nick);
                } else if (d === 42) { // *
                    buffer.updateNick(group, nick);
                }
            }
        });
    };

    var eventHandlers = {
        _buffer_closing: handleBufferClosing,
        _buffer_line_added: handleBufferLineAdded,
        _buffer_opened: handleBufferOpened,
        _buffer_title_changed: handleBufferTitleChanged,
        _buffer_renamed: handleBufferRenamed,
        _nicklist: handleNicklist,
        _nicklist_diff: handleNicklistDiff
    };

    $rootScope.$on('onMessage', function(event, message) {
        if (_.has(eventHandlers, message.id)) {
            eventHandlers[message.id](message);
        }
    });

    var handleEvent = function(event) {
        if (_.has(eventHandlers, event.id)) {
            eventHandlers[event.id](event);
        }
    };

    return {
        handleEvent: handleEvent,
        handleLineInfo: handleLineInfo,
        handleHotlistInfo: handleHotlistInfo,
        handleNicklist: handleNicklist
    };

}]);

weechat.factory('connection',
                ['$rootScope',
                 '$log',
                 'handlers',
                 'models',
                 'ngWebsockets',
function($rootScope,
         $log,
         handlers,
         models,
         ngWebsockets) {

    var protocol = new weeChat.Protocol();

    // Takes care of the connection and websocket hooks

    var connect = function (host, port, passwd, ssl, noCompression) {
        var proto = ssl ? 'wss' : 'ws';
        var url = proto + "://" + host + ":" + port + "/weechat";

        var onopen = function () {


            // Helper methods for initialization commands
            var _initializeConnection = function(passwd) {
                // This is not the proper way to do this.
                // WeeChat does not send a confirmation for the init.
                // Until it does, We need to "assume" that formatInit
                // will be received before formatInfo
                ngWebsockets.send(
                    weeChat.Protocol.formatInit({
                        password: passwd,
                        compression: noCompression ? 'off' : 'zlib'
                    })
                );

                return ngWebsockets.send(
                    weeChat.Protocol.formatInfo({
                        name: 'version'
                    })
                );
            };

            var _requestHotlist = function() {
                return ngWebsockets.send(
                    weeChat.Protocol.formatHdata({
                        path: "hotlist:gui_hotlist(*)",
                        keys: []
                    })
                );
            };

            var _requestNicklist = function() {
                return ngWebsockets.send(
                    weeChat.Protocol.formatNicklist({
                    })
                );
            };

            var _requestBufferInfos = function() {
                return ngWebsockets.send(
                    weeChat.Protocol.formatHdata({
                        path: 'buffer:gui_buffers(*)',
                        keys: ['local_variables,notify,number,full_name,short_name,title']
                    })
                );
            };

            var _requestSync = function() {
                return ngWebsockets.send(
                    weeChat.Protocol.formatSync({})
                );
            };


            // First command asks for the password and issues
            // a version command. If it fails, it means the we
            // did not provide the proper password.
            _initializeConnection(passwd).then(
                function() {
                    // Connection is successful
                    // Send all the other commands required for initialization
                    _requestBufferInfos().then(function(bufinfo) {
                        var bufferInfos = bufinfo.objects[0].content;
                        // buffers objects
                        for (var i = 0; i < bufferInfos.length ; i++) {
                            var buffer = new models.Buffer(bufferInfos[i]);
                            models.addBuffer(buffer);
                            // Switch to first buffer on startup
                            if (i === 0) {
                                models.setActiveBuffer(buffer.id);
                            }
                        }
                    });

                    _requestHotlist().then(function(hotlist) {
                        handlers.handleHotlistInfo(hotlist);
                    });

                    _requestNicklist().then(function(nicklist) {
                        handlers.handleNicklist(nicklist);
                    });

                    _requestSync();
                    $log.info("Connected to relay");
                    $rootScope.connected = true;
                },
                function() {
                    // Connection got closed, lets check if we ever was connected successfully
                    if (!$rootScope.waseverconnected) {
                        $rootScope.passwordError = true;
                    }
                }
            );

        };

        var onmessage = function() {
            // If we recieve a message from WeeChat it means that
            // password was OK. Store that result and check for it
            // in the failure handler.
            $rootScope.waseverconnected = true;
        };


        var onclose = function () {
            /*
             * Handles websocket disconnection
             */
            $log.info("Disconnected from relay");
            ngWebsockets.failCallbacks('disconnection');
            $rootScope.connected = false;
            $rootScope.$emit('relayDisconnect');
            $rootScope.$apply();
        };

        var onerror = function (evt) {
            /*
             * Handles cases when connection issues come from
             * the relay.
             */
            $log.error("Relay error" + evt.data);

            if (evt.type === "error" && this.readyState !== 1) {
                ngWebsockets.failCallbacks('error');
                $rootScope.errorMessage = true;
            }
        };

        protocol.setId = function(id, message) {
            return '(' + id + ') ' + message;
        };


        ngWebsockets.connect(url,
                     protocol,
                     {
                         'binaryType': "arraybuffer",
                         'onopen': onopen,
                         'onclose': onclose,
                         'onmessage': onmessage,
                         'onerror': onerror,
                     });

    };

    var disconnect = function() {
        ngWebsockets.send(weeChat.Protocol.formatQuit());
    };

    /*
     * Format and send a weechat message
     *
     * @returns the angular promise
     */
    var sendMessage = function(message) {
        ngWebsockets.send(weeChat.Protocol.formatInput({
            buffer: models.getActiveBuffer().fullName,
            data: message
        }));
    };

    var sendCoreCommand = function(command) {
        ngWebsockets.send(weeChat.Protocol.formatInput({
            buffer: 'core.weechat',
            data: command
        }));
    };

    var fetchMoreLines = function(numLines) {
        var buffer = models.getActiveBuffer();
        // Calculate number of lines to fetch, at least as many as the parameter
        numLines = Math.max(numLines, buffer.requestedLines * 2);

        // Indicator that we are loading lines, hides "load more lines" link
        $rootScope.loadingLines = true;
        // Send hdata request to fetch lines for this particular buffer
        ngWebsockets.send(
            weeChat.Protocol.formatHdata({
                // "0x" is important, otherwise it won't work
                path: "buffer:0x" + buffer.id + "/own_lines/last_line(-" + numLines + ")/data",
                keys: []
            })
        ).then(function(lineinfo) {
            // delete old lines and add new ones
            var oldLength = buffer.lines.length;
            var setReadmarker = (buffer.lastSeen >= 0);
            buffer.lines.length = 0;
            buffer.requestedLines = 0;
            // Count number of lines recieved
            var linesReceivedCount = lineinfo.objects[0].content.length;

            // Parse the lines
            handlers.handleLineInfo(lineinfo, true);

            if (setReadmarker) {
                // Read marker was somewhere in the old lines - we don't need it any more,
                // set it to the boundary between old and new. This way, we stay at the exact
                // same position in the text through the scrollWithBuffer below
                buffer.lastSeen = buffer.lines.length - oldLength - 1;
            } else {
                // We are currently fetching at least some unread lines, so we need to keep
                // the read marker position correct
                buffer.lastSeen -= oldLength;
            }
            // We request more lines, but didn't get more. No more lines!
            if (oldLength === buffer.lines.length) {
                buffer.allLinesFetched  = true;
            }
            // We requested more lines than we got, no more lines.
            if (linesReceivedCount < numLines) {
                buffer.allLinesFetched = true;
            }
            $rootScope.loadingLines = false;
            // Scroll read marker to the center of the screen
            $rootScope.scrollWithBuffer(true);
        });
    };


    return {
        connect: connect,
        disconnect: disconnect,
        sendMessage: sendMessage,
        sendCoreCommand: sendCoreCommand,
        fetchMoreLines: fetchMoreLines
    };
}]);

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', '$store', '$timeout', '$log', 'models', 'connection', function ($rootScope, $scope, $store, $timeout, $log, models, connection) {

    $rootScope.countWatchers = function () {
        var root = $(document.getElementsByTagName('body'));
        var watchers = [];

        var f = function (element) {
            if (element.data().hasOwnProperty('$scope')) {
                angular.forEach(element.data().$scope.$$watchers, function (watcher) {
                    watchers.push(watcher);
                });
            }

            angular.forEach(element.children(), function (childElement) {
                f($(childElement));
            });
        };

        f(root);
        console.log(watchers.length);
    };


    $rootScope.isMobileDevice = function() {
        // TODO don't base detection solely on screen width
        var mobile_cutoff = 968;
        return (document.body.clientWidth < mobile_cutoff);
    };


    // Ask for permission to display desktop notifications
    $scope.requestNotificationPermission = function() {
        // Firefox
        if (window.Notification) {
            Notification.requestPermission(function(status) {
                $log.info('Notification permission status: ', status);
                if (Notification.permission !== status) {
                    Notification.permission = status;
                }
            });
        }

        // Webkit
        if (window.webkitNotifications !== undefined) {
            var havePermission = window.webkitNotifications.checkPermission();
            if (havePermission !== 0) { // 0 is PERMISSION_ALLOWED
                $log.info('Notification permission status: ', havePermission === 0);
                window.webkitNotifications.requestPermission();
            }
        }
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
        console.log('adding event listener for', $scope.documentVisibilityChange);
        document.addEventListener($scope.documentVisibilityChange, function() {
            if (!document[$scope.documentHidden]) {
                // We just switched back to the glowing-bear window and unread messages may have
                // accumulated in the active buffer while the window was in the background
                var buffer = models.getActiveBuffer();
                buffer.unread = 0;
                buffer.notification = 0;

                // Trigger title and favico update
                $rootScope.$emit('notificationChanged');

                // the unread badge in the bufferlist doesn't update if we don't do this
                $rootScope.$apply();
            }
        }, false);
    }


    // Reduce buffers with "+" operation over a key. Mostly useful for unread/notification counts.
    $rootScope.unreadCount = function(type) {
        if (!type) {
            type = "unread";
        }

        // Do this the old-fashioned way with iterating over the keys, as underscore proved to be error-prone
        var keys = Object.keys(models.model.buffers);
        var count = 0;
        for (var key in keys) {
            count += models.model.buffers[keys[key]][type];
        }

        return count;
    };

    $rootScope.updateTitle = function() {
        var notifications = $rootScope.unreadCount('notification');
        if (notifications > 0) {
            // New notifications deserve an exclamation mark
            $rootScope.notificationStatus = '(' + notifications + ') ';
        } else {
            $rootScope.notificationStatus = '';
        }

        var activeBuffer = models.getActiveBuffer();
        if(activeBuffer) {
            $rootScope.pageTitle = activeBuffer.shortName + ' | ' + activeBuffer.title;
        }
    };

    $scope.updateFavico = function() {
        var notifications = $rootScope.unreadCount('notification');
        if (notifications > 0) {
            $scope.favico.badge(notifications, {
                    bgColor: '#d00',
                    textColor: '#fff'
            });
        } else {
            var unread = $rootScope.unreadCount('unread');
            if (unread === 0) {
                $scope.favico.reset();
            } else {
                $scope.favico.badge(unread, {
                    bgColor: '#5CB85C',
                    textColor: '#ff0'
                });
            }
        }
    };

    $rootScope.$on('activeBufferChanged', function() {
        $rootScope.scrollWithBuffer(true);

        var ab = models.getActiveBuffer();
        if (ab.requestedLines < $scope.lines) {
            // buffer has not been loaded, but some lines may already be present if they arrived after we connected
            $scope.fetchMoreLines($scope.lines);
        }
        $rootScope.updateTitle(ab);

        // If user wants to sync hotlist with weechat
        // we will send a /buffer bufferName command every time
        // the user switches a buffer. This will ensure that notifications
        // are cleared in the buffer the user switches to
        if ($scope.hotlistsync && ab.fullName) {
            connection.sendCoreCommand('/buffer ' + ab.fullName);
        }

        // Clear search term on buffer change
        $scope.search = '';

        // Check if we should show nicklist or not
        $scope.showNicklist = $scope.updateShowNicklist();

        if (!$rootScope.isMobileDevice()) {
            $('#sendMessage').focus();
        }
    });

    $scope.favico = new Favico({animation: 'none'});

    $rootScope.$on('notificationChanged', function() {
        $rootScope.updateTitle();

        if ($scope.useFavico && $scope.favico) {
            $scope.updateFavico();
        }
    });

    $rootScope.$on('relayDisconnect', function() {
        // this reinitialze just breaks the bufferlist upon reconnection.
        // Disabled it until it's fully investigated and fixed
        //models.reinitialize();
        $rootScope.$emit('notificationChanged');
    });

    $scope.showSidebar = true;

    $scope.buffers = models.model.buffers;

    $scope.activeBuffer = models.getActiveBuffer;

    $rootScope.waseverconnected = false;

    $rootScope.models = models;

    $rootScope.buffer = [];

    $rootScope.iterCandidate = null;

    $store.bind($scope, "host", "localhost");
    $store.bind($scope, "port", "9001");
    $store.bind($scope, "proto", "weechat");
    $store.bind($scope, "ssl", false);
    $store.bind($scope, "savepassword", false);
    if ($scope.savepassword) {
        $store.bind($scope, "password", "");
    }

    // If we are on mobile change some defaults
    // We use 968 px as the cutoff, which should match the value in glowingbear.css
    var nonicklist = false;
    var noembed = false;
    var notimestamp = false;

    if ($rootScope.isMobileDevice()) {
        nonicklist = true;
        noembed = true;
        notimestamp = true;
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
    $store.bind($scope, "orderbyserver", false);
    // Save setting for updating favicon
    $store.bind($scope, "useFavico", true);
    // Save setting for notimestamp
    $store.bind($scope, "notimestamp", notimestamp);
    // Save setting for playing sound on notification
    $store.bind($scope, "soundnotification", false);

    // Save setting for displaying embeds in rootScope so it can be used from service
    $rootScope.visible = $scope.noembed === false;

    // Open and close panels while on mobile devices through swiping
    $scope.swipeSidebar = function() {
        if ($rootScope.isMobileDevice()) {
            $scope.showSidebar = !$scope.showSidebar;
        }
    };

    $scope.openNick = function() {
        if ($rootScope.isMobileDevice()) {
            if ($scope.nonicklist) {
                $scope.nonicklist = false;
            }
        }
    };

    $scope.closeNick = function() {
        if ($rootScope.isMobileDevice()) {
            if (!$scope.nonicklist) {
                $scope.nonicklist = true;
            }
        }
    };

    // Watch model and update show setting when it changes
    $scope.$watch('noembed', function() {
        $rootScope.visible = $scope.noembed === false;
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
            $scope.updateFavico();
        } else {
            $scope.favico.reset();
        }
    });


    $scope.setActiveBuffer = function(bufferId, key) {
        // If we are on mobile we need to collapse the menu on sidebar clicks
        // We use 968 px as the cutoff, which should match the value in glowingbear.css
        if ($rootScope.isMobileDevice()) {
            $scope.showSidebar = false;
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


    // Calculate number of lines to fetch
    $scope.calculateNumLines = function() {
        var lineHeight = document.querySelector(".bufferline").clientHeight;
        var areaHeight = document.querySelector("#bufferlines").clientHeight;
        // Fetch 10 lines more than theoretically needed so that scrolling up will correctly trigger the loading of more lines
        // Also, some lines might be hidden, so it's probably better to have a bit of buffer there
        var numLines = Math.ceil(areaHeight/lineHeight + 10);
        $scope.lines = numLines;
    };
    $scope.calculateNumLines();

    // Recalculate number of lines on resize
    window.addEventListener("resize", _.debounce(function() {
        // Recalculation fails when not connected
        if ($rootScope.connected) {
            $scope.calculateNumLines();
        }
    }, 100));


    $rootScope.loadingLines = false;
    $scope.fetchMoreLines = function() {
        connection.fetchMoreLines($scope.lines);
    };

    $rootScope.scrollWithBuffer = function(nonIncremental) {
        // First, get scrolling status *before* modification
        // This is required to determine where we were in the buffer pre-change
        var bl = document.getElementById('bufferlines');
        var sVal = bl.scrollHeight - bl.clientHeight;

        var scroll = function() {
            var sTop = bl.scrollTop;
            // Determine if we want to scroll at all
            // Give the check 3 pixels of slack so you don't have to hit
            // the exact spot. This fixes a bug in some browsers
            if ((nonIncremental && sTop < sVal) || (Math.abs(sTop - sVal) < 3)) {
                var readmarker = document.querySelector(".readmarker");
                if (nonIncremental && readmarker) {
                    // Switching channels, scroll to read marker
                    bl.scrollTop = readmarker.offsetTop - readmarker.parentElement.scrollHeight + readmarker.scrollHeight;
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
        $scope.requestNotificationPermission();
        connection.connect($scope.host, $scope.port, $scope.password, $scope.ssl);
    };
    $scope.disconnect = function() {
        connection.disconnect();
    };
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


    /* Function gets called from bufferLineAdded code if user should be notified */
    $rootScope.createHighlight = function(buffer, message) {
        var title = '';
        var body = '';
        if (['#', '&', '+', '!'].indexOf(buffer.shortName.charAt(0)) < 0) {
            title = 'Private message from ';
            body = message.text;
        } else {
            title = 'Highlight in ';
            var prefix = '';
            for (var i = 0; i < message.prefix.length; i++) {
                prefix += message.prefix[i].text;
            }
            body = '<' + prefix + '> ' + message.text;
        }
        title += buffer.shortName;
        title += buffer.fullName.replace(/irc.([^\.]+)\..+/, " ($1)");

        var notification = new Notification(title, {
            body: body,
            icon: 'img/favicon.png'
        });

        // Cancel notification automatically
        var timeout = 15*1000;
        notification.onshow = function() {
            setTimeout(function() {
                notification.close();
            }, timeout);
        };

        // Click takes the user to the buffer
        notification.onclick = function() {
            models.setActiveBuffer(buffer.id);
            window.focus();
            notification.close();
        };

        if ($scope.soundnotification) {
            // TODO fill in a sound file
            var audioFile = "assets/audio/sonar";
            var soundHTML = '<audio autoplay="autoplay"><source src="' + audioFile + '.ogg" type="audio/ogg" /><source src="' + audioFile + '.mp3" type="audio/mpeg" /></audio>';
            document.getElementById("soundNotification").innerHTML = soundHTML;
        }
    };

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
        // Use flat nicklist to check if empty
        if (ab.flatNicklist().length === 0) {
            return false;
        }
        return true;
    };

    $rootScope.switchToActivityBuffer = function() {
        // Find next buffer with activity and switch to it
        var sortedBuffers = _.sortBy($scope.buffers, 'number');
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
                models.setActiveBuffer($scope.filteredBuffers[0].id);
            }
            $scope.search = '';
        }
    };

    // Prevent user from accidentally leaving the page
    window.onbeforeunload = function(event) {
        if ($rootScope.connected) {
            event.preventDefault();
            // Chrome requires us to set this or it will not show the dialog
            event.returnValue = "You have an active connection to your WeeChat relay. Please disconnect using the button in the top-right corner or by pressing the Escape key.";
        }
        $scope.favico.reset();
    };

}]
);

weechat.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.when('/', {
            templateUrl: 'index.html',
            controller: 'WeechatCtrl'
        });
    }
]);


weechat.directive('plugin', function() {
    /*
     * Plugin directive
     * Shows additional plugin content
     */
    return {
        templateUrl: 'directives/plugin.html',

        scope: {
            plugin: '=data',
        },

        controller: function($scope) {

            $scope.displayedContent = "";

            $scope.hideContent = function() {
                $scope.plugin.visible = false;
            };

            $scope.showContent = function() {
                /*
                 * Shows the plugin content.
                 * displayedContent is bound to the DOM.
                 * Actual plugin content is only fetched when
                 * content is shown.
                 */
                $scope.displayedContent = $scope.plugin.content;
                $scope.plugin.visible = true;

                // Scroll embed content into view
                var scroll = function() {
                    var embed = document.querySelector(".embed_" + $scope.plugin.$$hashKey);
                    if (embed) {
                        embed.scrollIntoViewIfNeeded();
                    }
                };
                setTimeout(scroll, 100);
            };
        }
    };
});


weechat.directive('inputBar', function() {

    return {

        templateUrl: 'directives/input.html',
        
        scope: {
            inputId: '@inputId',
        },

        controller: function($rootScope,
                             $scope,
                             $element,
                             connection,
                             models) {

            /*
             * Returns the input element
             */
            $scope.getInputNode = function() {
                return $element.find('input')[0];
            };

            $scope.completeNick = function() {
                // input DOM node
                var inputNode = $scope.getInputNode();

                // get current input
                var inputText = inputNode.value;

                // get current caret position
                var caretPos = inputNode.selectionStart;

                // create flat array of nicks
                var activeBuffer = models.getActiveBuffer();

                // complete nick
                var nickComp = IrcUtils.completeNick(inputText, caretPos,
                                                     $scope.iterCandidate, activeBuffer.flatNicklist(), ':');

                // remember iteration candidate
                $scope.iterCandidate = nickComp.iterCandidate;

                // update current input
                inputNode.value = nickComp.text;

                // update current caret position
                inputNode.focus();
                inputNode.setSelectionRange(nickComp.caretPos, nickComp.caretPos);
            };


            // Send the message to the websocket
            $scope.sendMessage = function() {

                var input = $scope.getInputNode();
                connection.sendMessage(input.value);
                models.getActiveBuffer().addToHistory(input.value);  // log to buffer history
                input.value = '';
            };

            // Handle key presses in the input bar
            $rootScope.handleKeyPress = function($event) {
                // don't do anything if not connected
                if (!$rootScope.connected) {
                    return true;
                }

                var inputNode = $scope.getInputNode();

                // Support different browser quirks
                var code = $event.keyCode ? $event.keyCode : $event.charCode;

                // any other key than Tab resets nick completion iteration
                var tmpIterCandidate = $scope.iterCandidate;
                $scope.iterCandidate = null;

                // Left Alt+[0-9] -> jump to buffer
                if ($event.altKey && !$event.ctrlKey && (code > 47 && code < 58)) {
                    if (code === 48) {
                        code = 58;
                    }

                    var bufferNumber = code - 48 - 1 ;
                    var activeBufferId = Object.keys(models.getBuffers())[bufferNumber];
                    if (activeBufferId) {
                        models.setActiveBuffer(activeBufferId);
                        $event.preventDefault();
                    }
                }

                // Tab -> nick completion
                if (code === 9 && !$event.altKey && !$event.ctrlKey) {
                    $event.preventDefault();
                    $scope.iterCandidate = tmpIterCandidate;
                    $scope.completeNick();
                    return true;
                }

                // Left Alt+n -> toggle nicklist
                if ($event.altKey && !$event.ctrlKey && code === 78) {
                    $event.preventDefault();
                    $rootScope.toggleNicklist();
                    return true;
                }

                // Alt+A -> switch to buffer with activity
                if ($event.altKey && (code === 97 || code === 65)) {
                    $event.preventDefault();
                    $rootScope.switchToActivityBuffer();
                    return true;
                }

                // Alt+L -> focus on input bar
                if ($event.altKey && (code === 76 || code === 108)) {
                    $event.preventDefault();
                    inputNode.focus();
                    inputNode.setSelectionRange(inputNode.value.length, inputNode.value.length);
                    return true;
                }

                // Alt+< -> switch to previous buffer
                if ($event.altKey && (code === 60 || code === 226)) {
                    var previousBuffer = models.getPreviousBuffer();
                    if (previousBuffer) {
                        models.setActiveBuffer(previousBuffer.id);
                        $event.preventDefault();
                        return true;
                    }
                }

                // Escape -> disconnect
                if (code === 27) {
                    $event.preventDefault();
                    connection.disconnect();
                    return true;
                }

                // Alt+G -> focus on buffer filter input
                if ($event.altKey && (code === 103 || code === 71)) {
                    $event.preventDefault();
                    document.getElementById('bufferFilter').focus();
                    return true;
                }

                // Arrow up -> go up in history
                if (code === 38) {
                    inputNode.value = models.getActiveBuffer().getHistoryUp(inputNode.value);
                    return true;
                }

                // Arrow down -> go down in history
                if (code === 40) {
                    inputNode.value = models.getActiveBuffer().getHistoryDown(inputNode.value);
                    return true;
                }
            };
        }
    };
});
