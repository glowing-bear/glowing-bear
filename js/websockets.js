var weechat = angular.module('weechat', ['localStorage', 'weechatModels', 'plugins']);

weechat.factory('colors', [function($scope) {

    // http://weechat.org/files/doc/devel/weechat_dev.en.html#color_codes_in_strings
    var part, fg, bg, attrs, colors = ['', 'black', 'dark gray', 'dark red', 'light red', 'dark green', 'light green', 'brown', 'yellow', 'dark blue', 'light blue', 'dark magenta', 'light magenta', 'dark cyan', 'light cyan', 'gray', 'white'];

    function setAttrs() {
        while (part.match(/^[\*\/\_\|]/)) {
            attrs.push(part.charAt(0));
            part = part.slice(1);
        }
    }

    function getColor() {
        var c;
        if (part.match(/^@/)) {
            c = part.slice(1, 5);
            part = part.slice(5);
        } else {
            c = part.slice(0, 2);
            part = part.slice(2);
        }
        return c;
    }

    function prepareCss(color) {
        /*
         * Translates a weechat color string to CSS
         */
        return'color-' + color.replace(' ', '-');
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


weechat.factory('handlers', ['$rootScope', 'colors', 'models', 'pluginManager', function($rootScope, colors, models, pluginManager) {

    var handleBufferClosing = function(message) {
        var bufferMessage = message['objects'][0]['content'][0];
        var buffer = new models.Buffer(bufferMessage);
        models.closeBuffer(buffer);
    }

    var handleBufferLineAdded = function(message) {
        var buffer_line = {}


        var message = new models.BufferLine(message);
        var buffer = models.getBuffer(message.buffer);
        message.metadata = pluginManager.contentForMessage(message.text);
        buffer.addLine(message);

        if (!buffer.active) {
            buffer.notification = true;
        }
    }

    var handleBufferOpened = function(message) {
        var bufferMessage = message['objects'][0]['content'][0];
        var buffer = new models.Buffer(bufferMessage);
        models.addBuffer(buffer);

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
        }

    }

    var handleEvent = function(event) {
        if (_.has(eventHandlers, event['id'])) {
            eventHandlers[event['id']](event);
        }

    }

    var findMetaData = function(message) {
        if (message.indexOf('youtube.com') != -1) {
            var index = message.indexOf("?v=");
            var token = message.substr(index+3);
            return '<iframe width="560" height="315" src="http://www.youtube.com/embed/' + token + '" frameborder="0" allowfullscreen></iframe>'
        }
        return null;
    }

    var eventHandlers = {
        bufinfo: handleBufferInfo,
        _buffer_closing: handleBufferClosing,
        _buffer_line_added: handleBufferLineAdded,
        _buffer_opened: handleBufferOpened
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
    var connect = function (hostport, proto, passwd) {
        websocket = new WebSocket("ws://" + hostport + "/weechat");
        websocket.binaryType = "arraybuffer"

        websocket.onopen = function (evt) {
            // FIXME: does password need to be sent only if protocol is not weechat?
            if (proto == "weechat") {
                doSend(WeeChatProtocol.formatInit({
                    password: passwd,
                    compression: 'off'
                }));
                doSend(WeeChatProtocol.formatHdata({
                    id: 'bufinfo',
                    path: 'buffer:gui_buffers(*)',
                    keys: ['full_name']
                }));
                doSend(WeeChatProtocol.formatSync({}));
            } else {

            }
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
            console.log("apply");
            $rootScope.$apply();
        }

        websocket.onerror = function (evt) {
            if (evt.type == "error" && websocket.readyState == 0) {
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

    return {
        connect: connect,
        sendMessage: sendMessage
    }
}]);

weechat.service('testService', function(){
    var count = 1;
    var list = [];
    this.incrementCount = function () {
        count++;
        list.push(count);
        return list;
    };
    this.getCount = function(){
       return list;
    }
    
});

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', '$store', 'models', 'connection', 'testService', function ($rootScope, $scope, $store, models, connection, testService) {

    $scope.buffers = models.model.buffers;
    $scope.activeBuffer = models.getActiveBuffer

    $scope.incrementAge = function () {
        models.model.age++;
        models.model.cats.push('nouveau chat');
    }


    $scope.clickS = function () {
        $scope.countS = testService.incrementCount();
    };

    $rootScope.commands = []


    
    $rootScope.models = models;

    $rootScope.buffer = []

    $store.bind($scope, "hostport", "localhost:9001");
    $store.bind($scope, "proto", "weechat");
    $store.bind($scope, "password", "");
    // TODO checkbox for saving password or not?
    // $scope.password = "";


    $scope.setActiveBuffer = function(key) {
        models.setActiveBuffer(key);
    };

    $scope.sendMessage = function() {
        connection.sendMessage($scope.command);
        $scope.command = "";
    };

    $scope.connect = function() {
        connection.connect($scope.hostport, $scope.proto, $scope.password);
    }
}]
                  );
