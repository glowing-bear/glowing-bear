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


weechat.factory('connection', ['$rootScope', 'colors', function($scope, colors) {
        protocol = new Protocol();
        var websocket = null;

        var doSend = function(message) {

          msgs = message.replace(/[\r\n]+$/g, "").split("\n");
          for (var i = 0; i < msgs.length; i++) {
            console.log('=' + msgs[i] + '=');
            $scope.commands.push("SENT: " + msgs[i]);
          }
          websocket.send(message);
        }
        var connect = function (hostport, proto, password) {
            websocket = new WebSocket("ws://" + hostport + "/weechat");
            websocket.binaryType = "arraybuffer"

            websocket.onopen = function (evt) {
              if (proto == "weechat") {
                doSend("init compression=off\nversion\n");
                doSend("hdata buffer:gui_buffers(*) full_name\n");
                doSend("sync\n");
              } else {
                doSend("PASS " + password + "\r\nNICK test\r\nUSER test 0 * :test\r\n");
              }
              $scope.connected = true;
              $scope.$apply();
            }

            websocket.onclose = function (evt) {
              console.log("disconnected", "Disconnected");
              $scope.connected = false;
            }

            websocket.onmessage = function (evt) {
	      protocol.setData(evt.data);
	      message = protocol.parse()
              console.log(message);
              $scope.commands.push("RECV: " + evt.data + " TYPE:" + evt.type) ;
              parseMessage(message);
	      data = evt.data;
              $scope.$apply();
            }


            websocket.onerror = function (evt) {
              console.log("error", "ERROR: " + evt.data);
            }

            this.websocket = websocket;
        }

        var parseMessage = function(message) {
            
            if (message['id'] == '_buffer_line_added') {
                types[message['id']](message);
            }

            if (!message['id']) {
                // should only be in case of hda objects
                parseObjects(message['objects']);
            }
        };
    
    
        var parseObjects = function(objects) {

            for (var i = 0; i < objects.length ; i++) {
                console.log('type', objects[i]['type']);
                if (objects[i]['type'] == 'hda') {
                    parseHdaObject(objects[i]);
                }
            }
        }

        var parseHdaObject = function(hdaObject) {
            console.log('parse hda', hdaObject['content'], hdaObject['content'].length);
            buffers = {};
            for (var i = 0; i < hdaObject['content'].length; i++) {
                content = hdaObject['content'][i];
                content['lines'] = [];
                console.log('content', content);
                var pointer = content['pointers'][0];
                buffers[pointer] = content;
            }

            $scope.buffers = buffers;
        }
    

        var handleBufferLineAdded = function(message) {

            var prefix = colors.parse(message['objects'][0]['content'][0]['prefix']);
            var text = colors.parse(message['objects'][0]['content'][0]['message']);
            var buffer = message['objects'][0]['content'][0]['buffer'];
            var buffer_line = _.union(prefix, text);
            console.log('BUFFER: ', $scope.buffers[buffer]);
            $scope.buffers[buffer]['lines'].push(buffer_line);
        }

        var sendMessage = function(message) {
            message = message + "\n"
            doSend(message);
        }

        var types = {
            _buffer_line_added: handleBufferLineAdded
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

    $scope.setActiveBuffer = function(key) {
        console.log('change buffer');
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
