var weechat = angular.module('weechat', []);

weechat.factory('connection', ['$rootScope', function($scope) {
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
                //doSend("init compression=off\nversion\n");
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
              console.log("recv", "&rArr; " + evt.data);
              protocol.setData(evt.data);
              console.log(protocol.parse());
              $scope.commands.push("RECV: " + evt.data + " TYPE:" + evt.type) ;
              data = evt.data;
              $scope.$apply();
            }
            websocket.onerror = function (evt) {
              console.log("error", "ERROR: " + evt.data);
            }

            this.websocket = websocket;
        }

        var sendMessage = function(message) {
            message = message + "\n"
            doSend(message);
        }
        return {
            connect: connect,
            sendMessage: sendMessage
        }
}]);

weechat.controller('WeechatCtrl', ['$rootScope', '$scope', 'connection', function ($rootScope, $scope, connection) {
    $rootScope.commands = []

    $scope.hostport = "localhost:9001"
    $scope.proto = "weechat"
    $scope.password = ""

    $scope.sendMessage = function() {
        connection.sendMessage($scope.command);
        $scope.command = "";
    },

    $scope.connect = function() {
        connection.connect($scope.hostport, $scope.proto, $scope.password);
    }
    }]
);
