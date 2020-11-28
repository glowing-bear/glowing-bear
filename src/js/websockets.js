(function() {
'use strict';

var websockets = angular.module('ngWebsockets', []);

websockets.factory('ngWebsockets',
                   ['$rootScope','$q',
function($rootScope, $q) {


    var protocol = null;

    var ws = null;
    var callbacks = {};
    var currentCallBackId = 0;

    /*
     * Fails every currently subscribed callback for the
     * given reason
     *
     * @param reason reason for failure
     */
    var failCallbacks = function(reason) {
        for (var i in callbacks) {
            callbacks[i].cb.reject(reason);
        }

    };


    /*
     * Returns the current callback id
     */
    var getCurrentCallBackId = function() {

        currentCallBackId += 1;

        if (currentCallBackId > 1000) {
            currentCallBackId = 0;
        }

        return currentCallBackId;
    };


    /* Send a message to the websocket and returns a promise.
     * See: http://docs.angularjs.org/api/ng.$q
     *
     * @param message message to send
     * @returns a promise
     */
    var send = function(message) {

        var cb = createCallback(message);

        message = protocol.setId(cb.id,
                                 message);

        ws.send(message);
        return cb.promise;
    };

    /*
     * Create a callback, adds it to the callback list
     * and return it.
     */
    var createCallback = function() {
        var defer = $q.defer();
        var cbId = getCurrentCallBackId();

        callbacks[cbId] = {
            time: new Date(),
            cb: defer
        };

        defer.id = cbId;

        return defer;
    };

    /*
     * Send all messages to the websocket and returns a promise that is resolved
     * when all message are resolved.
     *
     * @param messages list of messages
     * @returns a promise
     */
    var sendAll = function(messages) {
        var promises = [];
        for (var i in messages) {
            var promise = send(messages[i]);
            promises.push(promise);
        }
        return $q.all(promises);
    };


    var onmessage = function (evt) {
        /*
         * Receives a message on the websocket
         */
        var message = protocol.parse(evt.data);
        if (_.has(callbacks, message.id)) {
            // see if it's bound to one of the callbacks
            var promise = callbacks[message.id];
            promise.cb.resolve(message);
            delete(callbacks[message.id]);
        } else {
            // otherwise emit it
            $rootScope.$emit('onMessage', message);
        }
        // Make sure all UI is updated with new data
        $rootScope.$apply();

    };

    var connect = function(url,
                           protocol_,
                           properties) {

        ws = new WebSocket(url);
        protocol = protocol_;
        for (var property in properties) {
            ws[property] = properties[property];
        }

        if ('onmessage' in properties) {
            ws.onmessage = function(event) {
                properties.onmessage(event);
                onmessage(event);
            };
        } else {
            ws.onmessage = onmessage;
        }
    };

    var disconnect = function() {
        ws.close();
    };

    return {
        send: send,
        sendAll: sendAll,
        connect: connect,
        disconnect: disconnect,
        failCallbacks: failCallbacks
    };

}]);
})();
