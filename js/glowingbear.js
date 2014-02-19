var weechat = angular.module('weechat', ['ngRoute', 'localStorage', 'weechatModels', 'plugins', 'ngSanitize', 'ngWebsockets', 'pasvaz.bindonce', 'ngTouch']);

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
        var channelRegex = /(^|\s)(#[a-z0-9-_]*[a-z][a-z0-9-_]*)/gmi;
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

    var handleLine = function(line, initial, loadingMoreLines) {
        var message = new models.BufferLine(line);
        var buffer = models.getBuffer(message.buffer);
        buffer.requestedLines++;
        // Only react to line if its displayed
        if (message.displayed) {
            message = plugins.PluginManager.contentForMessage(message, $rootScope.visible);
            buffer.addLine(message);

            if (initial) {
                buffer.lastSeen++;
            }

            if (buffer.active && !initial && !loadingMoreLines) {
                $rootScope.scrollWithBuffer();
            }

            if (!initial && !buffer.active) {
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
    var handleLineInfo = function(message, initial, loadingMoreLines) {
        var lines = message.objects[0].content.reverse();
        if (initial === undefined) {
            initial = true;
        }
        lines.forEach(function(l) {
            handleLine(l, initial, loadingMoreLines);
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
                 '$store',
                 'handlers',
                 'models',
                 'ngWebsockets',
function($rootScope,
         $log,
         storage,
         handlers,
         models,
         ngWebsockets) {

    protocol = new weeChat.Protocol();

    // Takes care of the connection and websocket hooks

    var _formatForWs = function(message) {
        /*
         * Formats a weechat message to be sent over
         * the websocket.
         */
        message.replace(/[\r\n]+$/g, "").split("\n");
        return message;
    };

    var _send = function(message) {
        return ngWebsockets.send(_formatForWs(message));
    };

    var _sendAll = function(messages) {
        for (var i in messages) {
            messages[i] = _formatForWs(messages[i]);
        }
        return ngWebsockets.sendAll(messages);
    };


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

        var onmessage = function(event) {
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
            failCallbacks('disconnection');
            $rootScope.connected = false;
            $rootScope.$apply();
        };

        var onerror = function (evt) {
            /*
             * Handles cases when connection issues come from
             * the relay.
             */
            $log.error("Relay error" + evt.data);

            if (evt.type === "error" && this.readyState !== 1) {
                failCallbacks('error');
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
            buffer.lines.length = 0;
            buffer.requestedLines = 0;
            handlers.handleLineInfo(lineinfo, false, true);

            // Advance read marker by number of newly loaded lines
            buffer.lastSeen += buffer.lines.length - oldLength;

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
    if (window.Notification) {
        // Request notification permission
        Notification.requestPermission(function (status) {
            $log.info('Notification permission status:',status);
            if (Notification.permission !== status) {
                Notification.permission = status;
            }
        });
    }

    var mobile_cutoff = 968;

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

    if (window.webkitNotifications !== undefined) {
        if (window.webkitNotifications.checkPermission() === 0) { // 0 is PERMISSION_ALLOWED
            $log.info('Notification permission status:', window.webkitNotifications.checkPermission() === 0);
            window.webkitNotifications.requestPermission();
        }
    }
    // Check for firefox & app installed
    if (navigator.mozApps !== undefined) {
        navigator.mozApps.getSelf().onsuccess = function _onAppReady(evt) {
            var app = evt.target.result;
            if (app) {
                $scope.isinstalled = true;
            } else {
                $scope.isinstalled = false;
            }
        };
    } else {
        $scope.isinstalled = false;
    }

    $rootScope.$on('activeBufferChanged', function() {
        $rootScope.scrollWithBuffer(true);

        var ab = models.getActiveBuffer();
        if (ab.requestedLines < $scope.lines) {
            // buffer has not been loaded, but some lines may already be present if they arrived after we connected
            $scope.fetchMoreLines($scope.lines);
        }
        $rootScope.pageTitle = ab.shortName + ' | ' + ab.title;

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
    });

    $scope.favico = new Favico({animation: 'none'});

    $rootScope.$on('notificationChanged', function() {
        var notifications = _.reduce(models.model.buffers, function(memo, num) { return (parseInt(memo)||0) + num.notification;});
        if (typeof notifications !== 'number') {
            return;
        }
        if (notifications > 0) {
            $scope.favico.badge(notifications, {
                    bgColor: '#d00',
                    textColor: '#fff'
            });
        } else {
            var unread = _.reduce(models.model.buffers, function(memo, num) { return (parseInt(memo)||0) + num.unread;});
            if (unread === 0) {
                $scope.favico.reset();
            } else {
                $scope.favico.badge(unread, {
                    bgColor: '#5CB85C',
                    textColor: '#ff0'
                });
            }
        }
    });

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

    // Save setting for displaying only buffers with unread messages
    $store.bind($scope, "onlyUnread", false);
    // Save setting for not showing timestamp
    $store.bind($scope, "notimestamp", false);
    // Save setting for syncing hotlist
    $store.bind($scope, "hotlistsync", true);
    // Save setting for displaying nicklist
    $store.bind($scope, "nonicklist", false);
    // Save setting for displaying embeds
    $store.bind($scope, "noembed", false);
    // Save setting for channel ordering
    $store.bind($scope, "orderbyserver", false);
    // Save setting for displaying embeds in rootScope so it can be used from service
    $rootScope.visible = $scope.noembed === false;

    // If we are on mobile chhange some defaults
    // We use 968 px as the cutoff, which should match the value in glowingbear.css
    if (document.body.clientWidth < mobile_cutoff) {
        $scope.nonicklist = true;
        $scope.noembed = true;
        $scope.notimestamp = true;
    }

    // Open and close panels while on mobile devices through swiping
    $scope.swipeSidebar = function() { 
        if (document.body.clientWidth < mobile_cutoff) {
            $('#sidebar').collapse('toggle');
        }
    };
    
    $scope.openNick = function() {
        if (document.body.clientWidth < mobile_cutoff) {
            if($scope.nonicklist) { 
                $scope.nonicklist = false;
            } 
        }
    };

    $scope.closeNick = function() {
        if (document.body.clientWidth < mobile_cutoff) {
            if(!$scope.nonicklist) { 
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

    $rootScope.predicate = $scope.orderbyserver ? 'serverSortKey' : 'number';

    $scope.setActiveBuffer = function(bufferId, key) {
        // If we are on mobile we need to collapse the menu on sidebar clicks
        // We use 968 px as the cutoff, which should match the value in glowingbear.css
        if (document.body.clientWidth < mobile_cutoff) {
            $('#sidebar').collapse('toggle');
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
    $scope.lines = function() {
        var lineHeight = document.querySelector(".bufferline").clientHeight;
        // I would have used document.querySelector("#bufferlines").clientHeight and added 5 to the total result, but that provides incorrect values on mobile
        var areaHeight = document.body.clientHeight;
        return Math.ceil(areaHeight/lineHeight);
    }();

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
        connection.connect($scope.host, $scope.port, $scope.password, $scope.ssl);
    };
    $scope.disconnect = function() {
        connection.disconnect();
    };
    $scope.install = function() {
        if (navigator.mozApps !== undefined) {
            var request = navigator.mozApps.install('http://torhve.github.io/glowing-bear/manifest.webapp');
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
        var messages = "";
        message.content.forEach(function(part) {
            if (part.text !== undefined) {
                messages += part.text + " ";
            }
        });

        var title = buffer.fullName;
        var content = messages;

        var timeout = 15*1000;
        $log.info('Displaying notification:buffer:',buffer,',message:',message,',with timeout:',timeout);
        var notification = new Notification(title, {body:content, icon:'img/favicon.png'});
        // Cancel notification automatically
        notification.onshow = function() {
            setTimeout(function() {
                notification.close();
            }, timeout);
        };
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
                break;
            }
        }
        // No notifications, find first buffer with unread lines instead
        for (i in sortedBuffers) {
            buffer = sortedBuffers[i];
            if (buffer.unread > 0) {
                $scope.setActiveBuffer(buffer.id);
                break;
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
            // TODO Switch to first matching buffer and reset query
            $scope.search = '';
        }
    };

    // Prevent user from accidentally leaving the page
    window.onbeforeunload = function(event) {
        event.preventDefault();
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
        controller: function($rootScope,
                             $scope,
                             connection,
                             models) {

            // Focuses itself when active buffer is changed
            /*
            $rootScope.$on('activeBufferChanged', function() {
                angular.element('#sendMessage').focus();
            });
            */

            $scope.completeNick = function() {
                // input DOM node
                var inputNode = document.getElementById('sendMessage');

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
                $scope.command = nickComp.text;

                // update current caret position
                inputNode.focus();
                inputNode.setSelectionRange(nickComp.caretPos, nickComp.caretPos);
            };


            // Send the message to the websocket
            $scope.sendMessage = function() {
                connection.sendMessage($scope.command);
                $scope.command = models.getActiveBuffer().addToHistory($scope.command);  // log to buffer history
            };

            // Handle key presses in the input bar
            $scope.handleKeyPress = function($event) {
                // don't do anything if not connected
                if (!$rootScope.connected) {
                    return true;
                }

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

                    var bufferNumber = code - 48;
                    var activeBuffer = models.getBufferByIndex(bufferNumber);
                    if (activeBuffer) {
                        models.setActiveBuffer(activeBuffer.id);
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
                    $scope.nonicklist = !$scope.nonicklist;
                    return true;
                }

                // Alt+A -> switch to buffer with activity
                if ($event.altKey && (code === 97 || code === 65)) {
                    $event.preventDefault();
                    $scope.switchToActivityBuffer();
                    return true;
                }

                // Alt+L -> focus on input bar
                if ($event.altKey && (code === 76 || code === 108)) {
                    $event.preventDefault();
                    var inputNode = document.getElementById('sendMessage');
                    inputNode.focus();
                    inputNode.setSelectionRange(inputNode.value.length, inputNode.value.length);
                    return true;
                }

                // Alt+< -> switch to previous buffer
                if ($event.altKey && code === 60) {
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

                // Ctrl+G -> focus on buffer filter input
                if ($event.ctrlKey && (code === 103 || code === 71)) {
                    $event.preventDefault();
                    document.getElementById('bufferFilter').focus();
                    return true;
                }

                // Arrow up -> go up in history
                if (code === 38) {
                    $scope.command = models.getActiveBuffer().getHistoryUp($scope.command);
                    return true;
                }

                // Arrow down -> go down in history
                if (code === 40) {
                    $scope.command = models.getActiveBuffer().getHistoryDown($scope.command);
                    return true;
                }
            };
        }
    };
});
