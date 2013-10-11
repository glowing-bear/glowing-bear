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

    // http://weechat.org/files/doc/devel/weechat_dev.en.html#color_codes_in_strings
    var part, fg, bg, attrs, colors = ['', 'black', 'dark gray', 'dark red', 'light red', 'dark green', 'light green', 'brown', 'yellow', 'dark blue', 'light blue', 'dark magenta', 'light magenta', 'dark cyan', 'light cyan', 'gray', 'white'];
    // XTerm 8-bit pallete
    var colors = [
                '#000000', '#AA0000', '#00AA00', '#AA5500', '#0000AA',
                '#AA00AA', '#00AAAA', '#AAAAAA', '#555555', '#FF5555',
                '#55FF55', '#FFFF55', '#5555FF', '#FF55FF', '#55FFFF',
                '#FFFFFF', '#000000', '#00005F', '#000087', '#0000AF',
                '#0000D7', '#0000FF', '#005F00', '#005F5F', '#005F87',
                '#005FAF', '#005FD7', '#005FFF', '#008700', '#00875F',
                '#008787', '#0087AF', '#0087D7', '#00AF00', '#00AF5F',
                '#00AF87', '#00AFAF', '#00AFD7', '#00AFFF', '#00D700',
                '#00D75F', '#00D787', '#00D7AF', '#00D7D7', '#00D7FF',
                '#00FF00', '#00FF5F', '#00FF87', '#00FFAF', '#00FFD7',
                '#00FFFF', '#5F0000', '#5F005F', '#5F0087', '#5F00AF',
                '#5F00D7', '#5F00FF', '#5F5F00', '#5F5F5F', '#5F5F87',
                '#5F5FAF', '#5F5FD7', '#5F5FFF', '#5F8700', '#5F875F',
                '#5F8787', '#5F87AF', '#5F87D7', '#5F87FF', '#5FAF00',
                '#5FAF5F', '#5FAF87', '#5FAFAF', '#5FAFD7', '#5FAFFF',
                '#5FD700', '#5FD75F', '#5FD787', '#5FD7AF', '#5FD7D7',
                '#5FD7FF', '#5FFF00', '#5FFF5F', '#5FFF87', '#5FFFAF',
                '#5FFFD7', '#5FFFFF', '#870000', '#87005F', '#870087',
                '#8700AF', '#8700D7', '#8700FF', '#875F00', '#875F5F',
                '#875F87', '#875FAF', '#875FD7', '#875FFF', '#878700',
                '#87875F', '#878787', '#8787AF', '#8787D7', '#8787FF',
                '#87AF00', '#87AF5F', '#87AF87', '#87AFAF', '#87AFD7',
                '#87AFFF', '#87D700', '#87D75F', '#87D787', '#87D7AF',
                '#87D7D7', '#87D7FF', '#87FF00', '#87FF5F', '#87FF87',
                '#87FFAF', '#87FFD7', '#87FFFF', '#AF0000', '#AF005F',
                '#AF0087', '#AF00AF', '#AF00D7', '#AF00FF', '#AF5F00',
                '#AF5F5F', '#AF5F87', '#AF5FAF', '#AF5FD7', '#AF5FFF',
                '#AF8700', '#AF875F', '#AF8787', '#AF87AF', '#AF87D7',
                '#AF87FF', '#AFAF00', '#AFAF5F', '#AFAF87', '#AFAFAF',
                '#AFAFD7', '#AFAFFF', '#AFD700', '#AFD75F', '#AFD787',
                '#AFD7AF', '#AFD7D7', '#AFD7FF', '#AFFF00', '#AFFF5F',
                '#AFFF87', '#AFFFAF', '#AFFFD7', '#AFFFFF', '#D70000',
                '#D7005F', '#D70087', '#D700AF', '#D700D7', '#D700FF',
                '#D75F00', '#D75F5F', '#D75F87', '#D75FAF', '#D75FD7',
                '#D75FFF', '#D78700', '#D7875F', '#D78787', '#D787AF',
                '#D787D7', '#D787FF', '#D7AF00', '#D7AF5F', '#D7AF87',
                '#D7AFAF', '#D7AFD7', '#D7AFFF', '#D7D700', '#D7D75F',
                '#D7D787', '#D7D7AF', '#D7D7D7', '#D7D7FF', '#D7FF00',
                '#D7FF5F', '#D7FF87', '#D7FFAF', '#D7FFD7', '#D7FFFF',
                '#FF0000', '#FF005F', '#FF0087', '#FF00AF', '#FF00D7',
                '#FF00FF', '#FF5F00', '#FF5F5F', '#FF5F87', '#FF5FAF',
                '#FF5FD7', '#FF5FFF', '#FF8700', '#FF875F', '#FF8787',
                '#FF87AF', '#FF87D7', '#FF87FF', '#FFAF00', '#FFAF5F',
                '#FFAF87', '#FFAFAF', '#FFAFD7', '#FFAFFF', '#FFD700',
                '#FFD75F', '#FFD787', '#FFD7AF', '#FFD7D7', '#FFD7FF',
                '#FFFF00', '#FFFF5F', '#FFFF87', '#FFFFAF', '#FFFFD7',
                '#FFFFFF', '#080808', '#121212', '#1C1C1C', '#262626',
                '#303030', '#3A3A3A', '#444444', '#4E4E4E', '#585858',
                '#626262', '#6C6C6C', '#767676', '#808080', '#8A8A8A',
                '#949494', '#9E9E9E', '#A8A8A8', '#B2B2B2', '#BCBCBC',
                '#C6C6C6', '#D0D0D0', '#DADADA', '#E4E4E4', '#EEEEEE'
            ]
    

    function setAttrs() {
        while (part.match(/^[\*\/\_\|]/)) {
            attrs.push(part.charAt(0));
            part = part.slice(1);
        }
    }

    function getColor() {
        var c;
        if (part.match(/^@/)) {
            c = part.slice(1, 6);
            part = part.slice(6);
        } else {
            c = part.slice(0, 2);
            part = part.slice(2);
        }
        return c;
    }

    function prepareCss(color) {
        /*
         * Translates a weechat color to CSS
         */
        return 'color: ' + color;
    }

    var prefixes = {
        '\x19': function() {
            if (part.match(/^F/)) {
                part = part.slice(1);
                setAttrs();
                fg = getColor();
            } else if (part.match(/^B/)) {
                part = part.slice(1);
                setAttrs();
                bg = getColor();
            } else {
                setAttrs();
                fg = getColor();
                if (part.match(/^,/)) {
                    part = part.slice(1);
                    bg = getColor();
                }
            }
        },
        '\x1A': function() {
            // Don't know what to do
        },
        '\x1B': function() {
            attrs = [];
        },
        '\x1C': function() {
            fg = '';
            bg = '';
        }
    };

    function parse(text) {
        if (!text) {
            return text;
        }
        var f, parts = text.split(/(\x19|\x1A|\x1B|\x1C)/);
        if (parts.length === 1) return [{
            text: parts[0]
        }];
        attrs = [];

        return parts.map(function(p) {
            var res, tmp = prefixes[p.charAt(0)];
            if (f) {
                part = p;
                f();
                res = {
                    text: part,
                    fg: colors[parseInt(fg, 10)],
                    bg: colors[parseInt(bg, 10)],
                    attrs: attrs
                };
                if (!res.fg) res.fg = fg;
                if (!res.bg) res.bg = bg;
            }
            f = tmp;
            return res;
        }).filter(function(p) {
            return p;
        });
    };






    return {

        setAttrs: setAttrs,
        getColor: getColor,
        prepareCss: prepareCss,
        parse: parse,
        parts: ['', 'black', 'dark gray', 'dark red', 'light red', 'dark green', 'light green', 'brown', 'yellow', 'dark blue', 'light blue', 'dark magenta', 'light magenta', 'dark cyan', 'light cyan', 'gray', 'white']
    }

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
            message.metadata = plugins.PluginManager.contentForMessage(message.text);
            buffer.addLine(message);

            if (buffer.active) {
                $rootScope.scrollToBottom();
            }

            if (!initial) {
                if (!buffer.active && _.contains(message.tags, 'notify_message') && !_.contains(message.tags, 'notify_none')) {
                    if (buffer.unread == '' || buffer.unread == undefined) {
                        buffer.unread = 1;
                    }else {
                        buffer.unread++;
                    }
                }

                if(message.highlight || _.contains(message.tags, 'notify_private') ) {
                    $rootScope.createHighlight(buffer, message);
                    buffer.notification = true;
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
     * Handle answers to (bufinfo) messages
     *
     * (bufinfo) messages are specified by this client. It is the first
     * message that is sent to the relay after connection.
     */
    var handleBufferInfo = function(message) {
        // buffer info from message
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

        // Request latest buffer lines for each buffer
        $rootScope.getLines();
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

    var handleEvent = function(event) {
        if (_.has(eventHandlers, event['id'])) {
            eventHandlers[event['id']](event);
        }

    }

    var eventHandlers = {
        bufinfo: handleBufferInfo,
        lineinfo: handleLineInfo,
        _buffer_closing: handleBufferClosing,
        _buffer_line_added: handleBufferLineAdded,
        _buffer_opened: handleBufferOpened,
        _buffer_title_changed: handleBufferTitleChanged,
        _buffer_renamed: handleBufferRenamed
    }

    return {
        handleEvent: handleEvent

    }

}]);

weechat.factory('connection', ['$rootScope', '$log', 'handlers', 'colors', 'models', function($rootScope, $log, handlers, colors, models) {
    protocol = new WeeChatProtocol();
    var websocket = null;


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
                doSend(WeeChatProtocol.formatInit({
                    password: passwd,
                    compression: 'off'
                }));
                doSend(WeeChatProtocol.formatHdata({
                    id: 'bufinfo',
                    path: 'buffer:gui_buffers(*)',
                keys: ['number,full_name,short_name,title']
            }));
            doSend(WeeChatProtocol.formatSync({}));

            $log.info("Connected to relay");
            $rootScope.connected = true;
            $rootScope.$apply();
        }

        websocket.onclose = function (evt) {
            $log.info("Disconnected from relay");
            $rootScope.connected = false;
            $rootScope.$apply();
        }

        websocket.onmessage = function (evt) {
	    message = protocol.parse(evt.data)
            handlers.handleEvent(message);
            $rootScope.commands.push("RECV: " + evt.data + " TYPE:" + evt.type) ;
            $rootScope.$apply();
        }

        websocket.onerror = function (evt) {
            if (evt.type == "error" && websocket.readyState != 1) {
                $rootScope.errorMessage = true;
            }
            $log.error("Relay error " + evt.data);
        }

        this.websocket = websocket;
    }

    var sendMessage = function(message) {
        doSend(WeeChatProtocol.formatInput({
            buffer: models.getActiveBuffer()['fullName'],
            data: message
        }));
    }

    var getLines = function(count) {
        doSend(WeeChatProtocol.formatHdata({
            id: 'lineinfo',
            path: "buffer:gui_buffers(*)/own_lines/last_line(-"+count+")/data",
            keys: []
        }));
    }

    return {
        send: doSend,
        getLines: getLines,
        connect: connect,
        sendMessage: sendMessage
    }
}]);

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', '$store', '$timeout', 'models', 'connection', function ($rootScope, $scope, $store, $timeout, models, connection, testService) {

    // Request notification permission
    Notification.requestPermission(function (status) {
        console.log('Notification permission status:',status);
        if (Notification.permission !== status) {
            Notification.permission = status;
        }
    });
    if(window.webkitNotifications != undefined) {
        if (window.webkitNotifications.checkPermission() == 0) { // 0 is PERMISSION_ALLOWED
            console.log('Notification permission status:', window.webkitNotifications.checkPermission() == 0);
            window.webkitNotifications.requestPermission();
        }
    }


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


    $scope.setActiveBuffer = function(key) {
        models.setActiveBuffer(key);
        var ab = models.getActiveBuffer();
        $rootScope.pageTitle = ab.shortName + ' | ' + ab.title;
    };

    $scope.$watch('models.getActiveBuffer()', function(newVal, oldVal) {
        if (newVal && newVal !== oldVal) { 
            $rootScope.scrollToBottom();
        }
    });

    $rootScope.scrollToBottom = function() {
        // FIXME doesn't work if the settimeout runs without a short delay
        // 300 ms seems to do the trick but creates a noticable flickr
        $timeout(function() {
            // TODO in the future, implement scrolling to last read line
            var lastline = document.querySelector('.bufferline:last-child');
            if(lastline) {
                window.scrollTo(0, lastline.offsetTop);
            }
        }, 300);
    }

    $scope.sendMessage = function() {
        connection.sendMessage($scope.command);
        $scope.command = "";
    };

    $scope.connect = function() {
        connection.connect($scope.host, $scope.port, $scope.password, $scope.ssl);
    }
    $rootScope.getLines = function() {
      connection.getLines($scope.lines);
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
        console.log('Displaying notification:buffer:',buffer,',message:',message,',with timeout:',timeout);
        var notification = new Notification(title, {body:content, icon:'img/favicon.png'});
        // Cancel notification automatically
        notification.onshow = function() {
            setTimeout(function() { notification.close() }, timeout);
        }
    };

    $scope.hasUnread = function(buffer) {
      if($scope.onlyUnread) {
        return (parseInt(buffer.unread) || 0) > 0;
      }
      return true;
    };

    $rootScope.switchToActivityBuffer = function() {
        // Find next buffer with activity and switch to it
        for(i in $scope.buffers) {
            var buffer = $scope.buffers[i];
            if(buffer.notification) {
                $scope.setActiveBuffer(buffer.id);
                break;
            }else if((parseInt(buffer.unread) || 0) > 0) {
                $scope.setActiveBuffer(buffer.id);
                break;
            }
        }
    }

    $scope.handleKeyPress = function($event) {
        // Support different browser quirks
        var code = $event.keyCode ? $event.keyCode : $event.charCode;

        //console.log('keypress', $event.charCode, $event.altKey);

        // Handle alt-a
        if($event.altKey && (code == 97 || code == 65)) {
            $rootScope.switchToActivityBuffer();
            return true;
        }
        // Handle ctrl-g
        if($event.ctrlKey && (code == 103 || code == 71)) {
            document.querySelector('#bufferFilter').focus();
            return true;
        }
    };
}]
                  );
