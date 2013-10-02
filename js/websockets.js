var weechat = angular.module('weechat', []);

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
        parse: parse,
        parts: ['', 'black', 'dark gray', 'dark red', 'light red', 'dark green', 'light green', 'brown', 'yellow', 'dark blue', 'light blue', 'dark magenta', 'light magenta', 'dark cyan', 'light cyan', 'gray', 'white']
    }

}]);

weechat.factory('pluginManager', ['youtubePlugin', 'urlPlugin', function(youtubePlugin, urlPlugin) {

    var plugins = [youtubePlugin, urlPlugin]

    var hookPlugin = function(plugin) {
        plugins.push(plugin);
    }

    var contentForMessage = function(message) {
        
        console.log('Message: ', message);
        var content = [];
        for (var i = 0; i < plugins.length; i++) {
            var pluginContent = plugins[i].contentForMessage(message);
            if (pluginContent) {
                var pluginContent = {'visible': false, 'content': pluginContent }
                content.push(pluginContent);
            }
        }
        
        console.log('Content: ', content);
        return content;
    }

    return {
        hookPlugin: hookPlugin,
        contentForMessage: contentForMessage
    }

}]);

weechat.factory('youtubePlugin', [function() {
    var contentForMessage = function(message) {
        if (message.indexOf('youtube.com') != -1) {
            var index = message.indexOf("?v=");
            var token = message.substr(index+3);
            return '<iframe width="560" height="315" src="http://www.youtube.com/embed/' + token + '" frameborder="0" allowfullscreen></iframe>'
        }
        return null;
    }

    return {
        contentForMessage: contentForMessage
    }
}]);

weechat.factory('urlPlugin', [function() {
    var contentForMessage = function(message) {
        var prefix = 'http://';
        var linkIndex = message.indexOf(prefix);
        if (linkIndex != -1) {
            var token = message.substr(linkIndex);
            return '<a href="' + token + '">' + token + '</a>';
        }
        return null;
    }

    return {
        contentForMessage: contentForMessage
    }
}]);



weechat.factory('handlers', ['$rootScope', 'colors', 'pluginManager', function($rootScope, colors, pluginManager) {

    var handleBufferClosing = function(message) {
        var buffer_pointer = message['objects'][0]['content'][0]['pointers'][0];
        $rootScope.closeBuffer(buffer_pointer);
    }

    var handleBufferLineAdded = function(message) {
        var buffer_line = {}
        var prefix = colors.parse(message['objects'][0]['content'][0]['prefix']);
        var text = colors.parse(message['objects'][0]['content'][0]['message']);
        var buffer = message['objects'][0]['content'][0]['buffer'];
        var message = _.union(prefix, text);
        buffer_line['message'] = message;

        if (!_isActiveBuffer(buffer)) {
            $rootScope.buffers[buffer]['notification'] = true;
        }

        var additionalContent = pluginManager.contentForMessage(text[0]['text']);

        if (additionalContent) {
            buffer_line['metadata'] = additionalContent;
        }

        $rootScope.buffers[buffer]['lines'].push(buffer_line);
    }

    /*
     * Returns whether or not this buffer is the active buffer
     */
    var _isActiveBuffer = function(buffer) {
      if ($rootScope.activeBuffer['id'] == buffer) {
          return true;
      } else {
          return false;
      }
    }

    var handleBufferOpened = function(message) {
        var fullName = message['objects'][0]['content'][0]['full_name']
        var buffer = message['objects'][0]['content'][0]['pointers'][0]
        $rootScope.buffers[buffer] = { 'id': buffer, 'lines':[], 'full_name':fullName }
        
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
        var buffers = {};
        for (var i = 0; i < bufferInfos.length ; i++) {
            var bufferInfo = bufferInfos[i];
            var pointer = bufferInfo['pointers'][0];
            bufferInfo['id'] = pointer;
            bufferInfo['lines'] = [];
            buffers[pointer] = bufferInfo
            if (i == 0) {
                // first buffer is active buffer by default
                $rootScope.activeBuffer = buffers[pointer];
            }
        }
        $rootScope.buffers = buffers;
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

weechat.factory('connection', ['$rootScope', '$log', 'handlers', 'colors', function($rootScope, $log, handlers, colors) {
    protocol = new Protocol();
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
    var connect = function (hostport, proto, password) {
        websocket = new WebSocket("ws://" + hostport + "/weechat");
        websocket.binaryType = "arraybuffer"

        websocket.onopen = function (evt) {
            // FIXME: does password need to be sent only if protocol is not weechat?
            if (proto == "weechat") {
                if (password) {
                    doSend("init compression=off,password=" + password + "\n");
                }

                doSend("(bufinfo) hdata buffer:gui_buffers(*) full_name\n");
                doSend("sync\n");
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
            $rootScope.$apply();
        }

        websocket.onerror = function (evt) {
            $log.error("Relay error " + evt.data);
        }

        this.websocket = websocket;
    }

    var sendMessage = function(message) {
        message = "input " + $rootScope.activeBuffer['full_name'] + " " + message + "\n"
        doSend(message);
    }

    return {
        connect: connect,
        sendMessage: sendMessage
    }
}]);

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', 'connection', function ($rootScope, $scope, connection) {
    $rootScope.commands = []

    $rootScope.buffer = []
    $rootScope.buffers = {}
    $rootScope.activeBuffer = null;
    $scope.hostport = "localhost:9001"
    $scope.proto = "weechat"
    $scope.password = ""


    $rootScope.closeBuffer = function(buffer_pointer) {
        delete($rootScope.buffers[buffer_pointer]);
        var first_buffer = _.keys($rootScope.buffers)[0];
        $scope.setActiveBuffer(first_buffer);
    }

    $scope.setActiveBuffer = function(key) {
        $rootScope.buffers[key]['notification'] = false;
        $rootScope.activeBuffer = $rootScope.buffers[key];
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
