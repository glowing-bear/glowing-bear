var weechat = angular.module('weechat', ['localStorage', 'weechatModels', 'plugins', 'ngSanitize']);

weechat.filter('toArray', function () {
    'use strict';

    return function (obj) {
        if (!(obj instanceof Object)) {
            return obj;
        }

        return Object.keys(obj).map(function (key) {
            return Object.defineProperty(obj[key], '$key', {__proto__: null, value: key});
        });
    }
});

weechat.factory('colors', [function($scope) {

    return {
        prepareCss: weeChat.color.prepareCss,
        parse: weeChat.color.parse
    };

}]);

weechat.factory('handlers', ['$rootScope', 'colors', 'models', 'plugins', function($rootScope, colors, models, plugins) {

    var handleBufferClosing = function(message) {
        var bufferMessage = message['objects'][0]['content'][0];
        var buffer = new models.Buffer(bufferMessage);
        models.closeBuffer(buffer);
    }

    var handleLine = function(line, initial) {
        var message = new models.BufferLine(line);
        // Only react to line if its displayed
        if(message.displayed) {
            var buffer = models.getBuffer(message.buffer);
            message = plugins.PluginManager.contentForMessage(message);
            buffer.addLine(message);

            if (buffer.active) {
                $rootScope.scrollToBottom();
            }

            if (!initial) {
                if (!buffer.active && !buffer.notify==0 && _.contains(message.tags, 'notify_message') && !_.contains(message.tags, 'notify_none')) {
                    buffer.unread++;
                    $rootScope.$emit('notificationChanged');
                }

                if(!buffer.notify==0 && message.highlight || _.contains(message.tags, 'notify_private') ) {
                    buffer.notification++;
                    $rootScope.createHighlight(buffer, message);
                    $rootScope.$emit('notificationChanged');
                }
            }
        }
    }

    var handleBufferLineAdded = function(message) {
        message['objects'][0]['content'].forEach(function(l) {
            handleLine(l, false);
        });
    }

    var handleBufferOpened = function(message) {
        var bufferMessage = message['objects'][0]['content'][0];
        var buffer = new models.Buffer(bufferMessage);
        models.addBuffer(buffer);
    }

    var handleBufferTitleChanged = function(message) {
        var obj = message['objects'][0]['content'][0];
        var buffer = obj['pointers'][0];
        var old = models.getBuffer(buffer);
        old.fullName = obj['full_name'];
        old.title = obj['title'];
        old.number = obj['number'];
    }

    var handleBufferRenamed = function(message) {
        var obj = message['objects'][0]['content'][0];
        var buffer = obj['pointers'][0];
        var old = models.getBuffer(buffer);
        old.fullName = obj['full_name'];
        old.shortName = obj['short_name'];
    }

    /*
     * Handle answers to (lineinfo) messages
     *
     * (lineinfo) messages are specified by this client. It is request after bufinfo completes
     */
    var handleLineInfo = function(message) {
        var lines = message['objects'][0]['content'].reverse();
        lines.forEach(function(l) {
            handleLine(l, true);
        });
    }

    /*
     * Handle answers to hotlist request
     */
    var handleHotlistInfo = function(message) {
        if (message.objects.length == 0) {
            return;
        }
        var hotlist = message['objects'][0]['content'];
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
            var unreadSum = _.reduce(l.count, function(memo, num){ return memo + num; }, 0);
            buffer.lastSeen = buffer.lines.length - 1 - unreadSum;
        });
    }

    var handleEvent = function(event) {

        if (_.has(eventHandlers, event['id'])) {
            eventHandlers[event['id']](event);
        }

    }

    var eventHandlers = {
        _buffer_closing: handleBufferClosing,
        _buffer_line_added: handleBufferLineAdded,
        _buffer_opened: handleBufferOpened,
        _buffer_title_changed: handleBufferTitleChanged,
        _buffer_renamed: handleBufferRenamed
    }

    return {
        handleEvent: handleEvent,
        handleLineInfo: handleLineInfo,
        handleHotlistInfo: handleHotlistInfo
    }

}]);

weechat.factory('connection', ['$q', '$rootScope', '$log', '$store', 'handlers', 'colors', 'models', function($q, $rootScope, $log, storage, handlers, colors, models) {
    protocol = new weeChat.Protocol();
    var websocket = null;

    var callbacks = {}
    var currentCallBackId = 0;

    var doSendWithCallback = function(message) {
        var defer = $q.defer();
        callbacks[++currentCallBackId] = {
            time: new Date,
            cb: defer
        }
        callBackIdString = "(" + currentCallBackId + ")";
        doSend(callBackIdString + " " + message);
        return defer.promise;
    }

    // Sanitizes messages to be sent to the weechat relay
    var doSend = function(message) {
        msgs = message.replace(/[\r\n]+$/g, "").split("\n");
        for (var i = 0; i < msgs.length; i++) {
            $log.log('=' + msgs[i] + '=');
            $rootScope.commands.push("SENT: " + msgs[i]);
        }
        websocket.send(message);
    }

    // Takes care of the connection and websocket hooks
    var connect = function (host, port, passwd, ssl) {
        var proto = ssl ? 'wss':'ws';
        websocket = new WebSocket(proto+"://" + host + ':' + port + "/weechat");
        websocket.binaryType = "arraybuffer"

        websocket.onopen = function (evt) {

            $log.info("Connected to relay");

            // First message must be an init request
            // with the password
            doSend(weeChat.Protocol.formatInit({
                    password: passwd,
                    compression: 'off'
            }));

            // password is bad until the next message
            // received proven the otherwise.
            $rootScope.passwordError = true;

            // We are asking for the weechat version here
            // to avoid two problems :
            //  - If the version is below 0.4.2, we will have a bug
            //    with websocket.
            //  - If the user password is wrong, we will be disconneted
            //    at this step.
            doSendWithCallback(weeChat.Protocol.formatInfo({
                name: 'version',
            })).then(function(message) {
                // If we have received this message
                // that means the user password is good.
                $rootScope.passwordError = false;

                // Parse the version info message to retrieve
                // the current weechat version.
                var version = message['objects'][0]['content']['value'];
                $rootScope.version = version;
                $log.info(version);
            }).then(function() {
                doSendWithCallback(weeChat.Protocol.formatHdata({
                    path: 'buffer:gui_buffers(*)',
                    keys: ['local_variables,notify,number,full_name,short_name,title']
                })).then(function(message) {
                    $log.info("Parsing bufinfo");
                    var bufferInfos = message['objects'][0]['content'];
                    // buffers objects
                    for (var i = 0; i < bufferInfos.length ; i++) {
                        var buffer = new models.Buffer(bufferInfos[i]);
                        models.addBuffer(buffer);
                        // Switch to first buffer on startup
                        if (i == 0) {
                            models.setActiveBuffer(buffer.id);
                        }
                    }
                }).then(function() {
                    $log.info("Parsing lineinfo");
                    doSendWithCallback(weeChat.Protocol.formatHdata({
                        path: "buffer:gui_buffers(*)/own_lines/last_line(-"+storage.get('lines')+")/data",
                        keys: []
                    })).then(function(hdata) {
                        handlers.handleLineInfo(hdata);
                    });
                }).then(function() {
                    $log.info("Requesting hotlist");
                    doSendWithCallback(weeChat.Protocol.formatHdata({
                        path: "hotlist:gui_hotlist(*)",
                        keys: []
                    })).then(function(hdata) {
                        handlers.handleHotlistInfo(hdata)
                    });
                }).then(function() {
                    doSend(weeChat.Protocol.formatSync({}));
                    $log.info("Synced");

                    // here we are really connected !
                    $rootScope.connected = true;
                });
            });
        }

        websocket.onclose = function (evt) {
            $log.info("Disconnected from relay");
            $rootScope.connected = false;
            if ($rootScope.passwordError == true) {
                $log.info("wrong password");
            }
            $rootScope.$apply();
        }

        websocket.onmessage = function (evt) {
	    message = protocol.parse(evt.data)
            if (_.has(callbacks, message['id'])) {
                var promise = callbacks[message['id']];
                promise.cb.resolve(message);
                delete(callbacks[message['id']]);
            } else {
                handlers.handleEvent(message);
            }
            $rootScope.commands.push("RECV: " + evt.data + " TYPE:" + evt.type) ;
            $rootScope.$apply();
        }

        websocket.onerror = function (evt) {
            // on error it means the connection problem
            // come from the relay not from the password.
            $rootScope.passwordError = false;

            if (evt.type == "error" && websocket.readyState != 1) {
                $rootScope.errorMessage = true;
            }
            $log.error("Relay error " + evt.data);
        }

        this.websocket = websocket;
    }

    var disconnect = function() {
        console.log(this.websocket);
        this.websocket.close();
    }

    var sendMessage = function(message) {
        doSend(weeChat.Protocol.formatInput({
            buffer: models.getActiveBuffer()['fullName'],
            data: message
        }));
    }

    var sendCoreCommand = function(command) {
        doSend(weeChat.Protocol.formatInput({
            buffer: 'core.weechat',
            data: command
        }));
    }


    return {
        send: doSend,
        connect: connect,
        disconnect: disconnect,
        sendMessage: sendMessage,
        sendCoreCommand: sendCoreCommand
    }
}]);

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', '$store', '$timeout', '$log', 'models', 'connection', function ($rootScope, $scope, $store, $timeout, $log, models, connection, testService) {

    // Request notification permission
    Notification.requestPermission(function (status) {
        $log.info('Notification permission status:',status);
        if (Notification.permission !== status) {
            Notification.permission = status;
        }
    });
    if(window.webkitNotifications != undefined) {
        if (window.webkitNotifications.checkPermission() == 0) { // 0 is PERMISSION_ALLOWED
            $log.info('Notification permission status:', window.webkitNotifications.checkPermission() == 0);
            window.webkitNotifications.requestPermission();
        }
    }

    $rootScope.$on('activeBufferChanged', function() {
        $rootScope.scrollToBottom();
        document.getElementById('sendMessage').focus();
        var ab = models.getActiveBuffer();
        $rootScope.pageTitle = ab.shortName + ' | ' + ab.title;

        // If user wants to sync hotlist with weechat
        // we will send a /buffer bufferName command every time
        // the user switches a buffer. This will ensure that notifications
        // are cleared in the buffer the user switches to
        if($scope.hotlistsync && ab.fullName) { 
            /*
            doSend(weeChat.Protocol.formatInput({
                buffer: 'weechat',
                data: '/buffer ' + ab.fullName
            }));
            */
            connection.sendCoreCommand('/buffer ' + ab.fullName);
        }
    });
    $rootScope.$on('notificationChanged', function() {
        var notifications = _.reduce(models.model.buffers, function(memo, num) { return (memo||0) + num.notification;});
        if (notifications > 0 ) {
            $scope.favico = new Favico({
                animation:'none'
            });
            $scope.favico.badge(notifications);
        }else {
            var unread = _.reduce(models.model.buffers, function(memo, num) { return (memo||0) + num.unread;});
            $scope.favico = new Favico({
                animation:'none',
                bgColor : '#5CB85C',
                textColor : '#ff0',
            });
            $scope.favico.badge(unread);
        }
    });

    $scope.buffers = models.model.buffers;
    $scope.activeBuffer = models.getActiveBuffer

    $rootScope.commands = []

    $rootScope.models = models;

    $rootScope.buffer = []

    $store.bind($scope, "host", "localhost");
    $store.bind($scope, "port", "9001");
    $store.bind($scope, "proto", "weechat");
    $store.bind($scope, "password", "");
    $store.bind($scope, "ssl", false);
    $store.bind($scope, "lines", "40");
    // TODO checkbox for saving password or not?
    // $scope.password = "";
    //

    // Save setting for displaying only buffers with unread messages
    $store.bind($scope, "onlyUnread", false);
    // Save setting for not showing timestamp
    $store.bind($scope, "notimestamp", false);
    // Save setting for syncing hotlist
    $store.bind($scope, "hotlistsync", true);


    $scope.setActiveBuffer = function(key) {
        models.setActiveBuffer(key);
    };

    $rootScope.scrollToBottom = function() {
        // FIXME doesn't work if the settimeout runs without a short delay
        // 300 ms seems to do the trick but creates a noticable flickr
        var scroll = function() {
            var readmarker = document.getElementById('readmarker');
            if(readmarker) {
              readmarker.scrollIntoView();
            }else{
                window.scroll(0, document.documentElement.scrollHeight - document.documentElement.clientHeight);
            }
        }
        scroll();
        $timeout(scroll, 300);
    }

    $scope.sendMessage = function() {
        connection.sendMessage($scope.command);
        $scope.command = "";
    };

    $scope.connect = function() {
        connection.connect($scope.host, $scope.port, $scope.password, $scope.ssl);
    }
    $scope.disconnect = function() {
        connection.disconnect();
    }

    /* Function gets called from bufferLineAdded code if user should be notified */
    $rootScope.createHighlight = function(buffer, message) {
        var messages = "";
        message.content.forEach(function(part) {
            if (part.text != undefined)
                messages += part.text + " ";
        });

        var title = buffer.fullName;
        var content = messages;

        var timeout = 15*1000;
        $log.info('Displaying notification:buffer:',buffer,',message:',message,',with timeout:',timeout);
        var notification = new Notification(title, {body:content, icon:'img/favicon.png'});
        // Cancel notification automatically
        notification.onshow = function() {
            setTimeout(function() { notification.close() }, timeout);
        }
    };

    $scope.hasUnread = function(buffer) {
        // if search is set, return every buffer 
        if($scope.search && $scope.search != "") {
            return true;
        }
        if($scope.onlyUnread) {
            // Always show current buffer in list
            if (models.getActiveBuffer() == buffer) {
                return true;
            }
            return buffer.unread > 0 || buffer.notification > 0;
        }
        return true;
    };

    $rootScope.switchToActivityBuffer = function() {
        // Find next buffer with activity and switch to it
        for(i in $scope.buffers) {
            var buffer = $scope.buffers[i];
            if(buffer.notification > 0) {
                $scope.setActiveBuffer(buffer.id);
                break;
            }else if(buffer.unread > 0) {
                $scope.setActiveBuffer(buffer.id);
                break;
            }
        }
    }

    $scope.handleKeyPress = function($event) {
        // Support different browser quirks
        var code = $event.keyCode ? $event.keyCode : $event.charCode;

        if ($event.altKey && (code > 47 && code < 58)) {
            if (code == 48) {
                code = 58;
            }

            var bufferNumber = code - 48;
            var activeBuffer = models.getBufferByIndex(bufferNumber);
            if (activeBuffer) {
                models.setActiveBuffer(activeBuffer.id);
                $event.preventDefault();
            }
        }

        //log('keypress', $event.charCode, $event.altKey);

        // Handle alt-a
        if($event.altKey && (code == 97 || code == 65)) {
            $event.preventDefault();
            $rootScope.switchToActivityBuffer();
            return true;
        }
        // Handle ctrl-g
        if($event.ctrlKey && (code == 103 || code == 71)) {
            document.getElementById('bufferFilter').focus();
            return true;
        }
    };
    $scope.handleSearchBoxKey = function($event) {
        // Support different browser quirks
        var code = $event.keyCode ? $event.keyCode : $event.charCode;
        // Handle escape
        if(code == 27) {
            $event.preventDefault();
            $scope.search = '';
        } // Handle enter
        else if (code == 13) {
            $event.preventDefault();
            // TODO Switch to first matching buffer and reset query
            $scope.search = '';
        }
    }

}]
                  );
