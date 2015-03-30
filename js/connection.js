(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('connection',
                ['$rootScope', '$log', 'handlers', 'models', 'ngWebsockets', function($rootScope,
         $log,
         handlers,
         models,
         ngWebsockets) {

    var protocol = new weeChat.Protocol();

    var connectionData = [];
    var reconnectTimer;

    // Takes care of the connection and websocket hooks
    var connect = function (host, port, passwd, ssl, noCompression, successCallback, failCallback) {
        connectionData = [host, port, passwd, ssl, noCompression];
        var proto = ssl ? 'wss' : 'ws';
        // If host is an IPv6 literal wrap it in brackets
        if (host.indexOf(":") !== -1) {
            host = "[" + host + "]";
        }
        var url = proto + "://" + host + ":" + port + "/weechat";
        $log.debug('Connecting to URL: ', url);

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
                function(version) {
                    handlers.handleVersionInfo(version);
                    // Connection is successful
                    // Send all the other commands required for initialization
                    _requestBufferInfos().then(function(bufinfo) {
                        handlers.handleBufferInfo(bufinfo);
                    });

                    _requestHotlist().then(function(hotlist) {
                        handlers.handleHotlistInfo(hotlist);

                        if (successCallback) {
                            successCallback();
                        }
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


        var onclose = function (evt) {
            /*
             * Handles websocket disconnection
             */
            $log.info("Disconnected from relay");
            if ($rootScope.userdisconnect || !$rootScope.waseverconnected) {
                handleClose(evt);
                $rootScope.userdisconnect = false;
            } else {
                reconnect(evt);
            }
        };

        var handleClose = function (evt) {
            if (ssl && evt && evt.code === 1006) {
                // A password error doesn't trigger onerror, but certificate issues do. Check time of last error.
                if (typeof $rootScope.lastError !== "undefined" && (Date.now() - $rootScope.lastError) < 1000) {
                    // abnormal disconnect by client, most likely ssl error
                    $rootScope.sslError = true;
                    $rootScope.$apply();
                }
            }
        };

        var onerror = function (evt) {
            /*
             * Handles cases when connection issues come from
             * the relay.
             */
            $log.error("Relay error", evt);
            $rootScope.lastError = Date.now();

            if (evt.type === "error" && this.readyState !== 1) {
                ngWebsockets.failCallbacks('error');
                $rootScope.errorMessage = true;
            }
        };

        try {
            ngWebsockets.connect(url,
                     protocol,
                     {
                         'binaryType': "arraybuffer",
                         'onopen': onopen,
                         'onclose': onclose,
                         'onmessage': onmessage,
                         'onerror': onerror
                     });
        } catch(e) {
            $log.debug("Websocket caught DOMException:", e);
            $rootScope.lastError = Date.now();
            $rootScope.errorMessage = true;
            $rootScope.securityError = true;
            $rootScope.$emit('relayDisconnect');

            if (failCallback) {
                failCallback();
            }
        }

    };

    var attemptReconnect = function (bufferId, timeout) {
        $log.info('Attempting to reconnect...');
        var d = connectionData;
        connect(d[0], d[1], d[2], d[3], d[4], function() {
            $rootScope.reconnecting = false;
            // on success, update active buffer
            models.setActiveBuffer(bufferId);
            $log.info('Sucessfully reconnected to relay');
        }, function() {
            // on failure, schedule another attempt
            if (timeout >= 600000) {
                // If timeout is ten minutes or more, give up
                $log.info('Failed to reconnect, giving up');
                handleClose();
            } else {
                $log.info('Failed to reconnect, scheduling next attempt in', timeout/1000, 'seconds');
                // Clear previous timer, if exists
                if (reconnectTimer !== undefined) {
                    clearTimeout(reconnectTimer);
                }
                reconnectTimer = setTimeout(function() {
                    // exponential timeout increase
                    attemptReconnect(bufferId, timeout * 1.5);
                }, timeout);
            }
        });
    };


    var reconnect = function (evt) {
        if (connectionData.length < 5) {
            // something is wrong
            $log.error('Cannot reconnect, connection information is missing');
            return;
        }

        // reinitialise everything, clear all buffers
        // TODO: this can be further extended in the future by looking
        // at the last line in ever buffer and request more buffers from
        // WeeChat based on that
        models.reinitialize();
        $rootScope.reconnecting = true;
        // Have to do this to get the reconnect banner to show
        $rootScope.$apply();

        var bufferId = models.getActiveBuffer().id,
            timeout = 3000;  // start with a three-second timeout

        reconnectTimer = setTimeout(function() {
            attemptReconnect(bufferId, timeout);
        }, timeout);
    };

    var disconnect = function() {
        $log.info('Disconnecting from relay');
        $rootScope.userdisconnect = true;
        ngWebsockets.send(weeChat.Protocol.formatQuit());
        // In case the backend doesn't repond we will close from our end
        var closeTimer = setTimeout(function() {
            ngWebsockets.disconnect();
            // We pretend we are not connected anymore
            // The connection can time out on its own
            ngWebsockets.failCallbacks('disconnection');
            $rootScope.connected = false;
            $rootScope.$emit('relayDisconnect');
            $rootScope.$apply();
        });
    };

    /*
     * Format and send a weechat message
     *
     * @returns the angular promise
     */
    var sendMessage = function(message) {
        ngWebsockets.send(weeChat.Protocol.formatInput({
            buffer: models.getActiveBufferReference(),
            data: message
        }));
    };

    var sendCoreCommand = function(command) {
        ngWebsockets.send(weeChat.Protocol.formatInput({
            buffer: 'core.weechat',
            data: command
        }));
    };

    var sendHotlistClear = function() {
        if (parseInt(models.version.charAt(0)) >= 1) {
            // WeeChat >= 1 supports clearing hotlist with this command
            sendMessage('/buffer set hotlist -1');
        } else {
            // If user wants to sync hotlist with weechat
            // we will send a /buffer bufferName command every time
            // the user switches a buffer. This will ensure that notifications
            // are cleared in the buffer the user switches to
            sendCoreCommand('/buffer ' + models.getActiveBuffer().fullName);
        }
    };

    var requestNicklist = function(bufferId, callback) {
        bufferId = bufferId || null;
        ngWebsockets.send(
            weeChat.Protocol.formatNicklist({
                buffer: bufferId
            })
        ).then(function(nicklist) {
            handlers.handleNicklist(nicklist);
            if (callback !== undefined) {
                callback();
            }
        });
    };


    var fetchMoreLines = function(numLines) {
        $log.debug('Fetching ', numLines, ' lines');
        var buffer = models.getActiveBuffer();
        if (numLines === undefined) {
            // Math.max(undefined, *) = NaN -> need a number here
            numLines = 0;
        }
        // Calculate number of lines to fetch, at least as many as the parameter
        numLines = Math.max(numLines, buffer.requestedLines * 2);

        // Indicator that we are loading lines, hides "load more lines" link
        $rootScope.loadingLines = true;
        // Send hdata request to fetch lines for this particular buffer
        return ngWebsockets.send(
            weeChat.Protocol.formatHdata({
                // "0x" is important, otherwise it won't work
                path: "buffer:0x" + buffer.id + "/own_lines/last_line(-" + numLines + ")/data",
                keys: []
            })
        ).then(function(lineinfo) {
//XXX move to handlers?
            // delete old lines and add new ones
            var oldLength = buffer.lines.length;
            // whether we already had all unread lines
            var hadAllUnreadLines = buffer.lastSeen >= 0;

            // clear the old lines
            buffer.lines.length = 0;
            // We need to set the number of requested lines to 0 here, because parsing a line
            // increments it. This is needed to also count newly arriving lines while we're
            // already connected.
            buffer.requestedLines = 0;
            // Count number of lines recieved
            var linesReceivedCount = lineinfo.objects[0].content.length;

            // Parse the lines
            handlers.handleLineInfo(lineinfo, true);

            // Correct the read marker for the lines that were counted twice
            buffer.lastSeen -= oldLength;

            // We requested more lines than we got, no more lines.
            if (linesReceivedCount < numLines) {
                buffer.allLinesFetched = true;
            }
            $rootScope.loadingLines = false;

            // Only scroll to read marker if we didn't have all unread lines previously, but have them now
            var scrollToReadmarker = !hadAllUnreadLines && buffer.lastSeen >= 0;
            // Scroll to correct position
            $rootScope.scrollWithBuffer(scrollToReadmarker, true);
        });
    };


    return {
        connect: connect,
        disconnect: disconnect,
        sendMessage: sendMessage,
        sendCoreCommand: sendCoreCommand,
        sendHotlistClear: sendHotlistClear,
        fetchMoreLines: fetchMoreLines,
        requestNicklist: requestNicklist,
        attemptReconnect: attemptReconnect
    };
}]);
})();
