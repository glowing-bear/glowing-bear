(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('connection',
                ['$rootScope', '$log', '$q', 'handlers', 'protocolModule', 'models', 'ngWebsockets', function($rootScope,
         $log,
         $q,
         handlers,
         protocolModule,
         models,
         ngWebsockets) {

    var protocol = new protocolModule.mod();

    // Takes care of the connection and websocket hooks

    var connect = function (host, port, passwd, ssl, noCompression) {
        var proto = ssl ? 'wss' : 'ws';
        // If host is an IPv6 literal wrap it in brackets
        if (host.indexOf(":") !== -1) {
            host = "[" + host + "]";
        }
        var url = proto + "://" + host + ":" + port + protocolModule.mod.mountpoint;
        $log.debug('Connecting to URL: ', url);

        var onopen = function () {


            // Helper methods for initialization commands
            var _initializeConnection = function(passwd) {
                if (protocolModule.mod.challengeAuth) {
                    return (function (){
                        var key = Math.random().toString(36).substr(2);
                        var cb = $q.defer();
                        ngWebsockets.send(
                            { challenge: key }
                        ).then(
                            function(msg) {
                                ngWebsockets.send(
                                    { login: CryptoJS
                                      .HmacSHA256(passwd, msg.challenge + key)
                                      .toString(CryptoJS.enc.Base64).replace(/=$/,'') }
                                ).then(function(message) { cb.resolve(message); });
                            },
                            function(error) {
                                cb.reject(error);
                            }
                        );
                        return cb.promise;
                    })();
                }

                // This is not the proper way to do this.
                // WeeChat does not send a confirmation for the init.
                // Until it does, We need to "assume" that formatInit
                // will be received before formatInfo
                ngWebsockets.send(
                    protocolModule.mod.formatInit({
                        password: passwd,
                        compression: noCompression ? 'off' : 'zlib'
                    })
                );

                return ngWebsockets.send(
                    protocolModule.mod.formatInfo({
                        name: 'version'
                    })
                );
            };

            var _requestHotlist = function() {
                return ngWebsockets.send(
                    protocolModule.mod.formatHdata({
                        path: "hotlist:gui_hotlist(*)",
                        keys: []
                    })
                );
            };

            var _requestBufferInfos = function() {
                return ngWebsockets.send(
                    protocolModule.mod.formatHdata({
                        path: 'buffer:gui_buffers(*)',
                        keys: ['local_variables,notify,number,full_name,short_name,title']
                    })
                );
            };

            var _requestSync = function() {
                return ngWebsockets.send(
                    protocolModule.mod.formatSync({})
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
                        //XXX move to handlers?
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
            ngWebsockets.failCallbacks('disconnection');
            $rootScope.connected = false;
            $rootScope.$emit('relayDisconnect');
            if (ssl && evt.code === 1006) {
                // A password error doesn't trigger onerror, but certificate issues do. Check time of last error.
                if (typeof $rootScope.lastError !== "undefined" && (Date.now() - $rootScope.lastError) < 1000) {
                    // abnormal disconnect by client, most likely ssl error
                    $rootScope.sslError = true;
                }
            }
            $rootScope.$apply();
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
        }

    };

    var disconnect = function() {
        ngWebsockets.send(protocolModule.mod.formatQuit());
    };

    /*
     * Format and send a weechat message
     *
     * @returns the angular promise
     */
    var sendMessage = function(message) {
        ngWebsockets.send(protocolModule.mod.formatInput({
            buffer: models.getActiveBuffer().fullName,
            data: message
        }));
    };

    var sendCoreCommand = function(command) {
        ngWebsockets.send(protocolModule.mod.formatInput({
            buffer: 'core.weechat',
            data: command
        }));
    };


    var requestNicklist = function(bufferId, callback) {
        bufferId = bufferId || null;
        ngWebsockets.send(
            protocolModule.mod.formatNicklist({
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
        var buffer = models.getActiveBuffer().textbuffer;
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
            protocolModule.mod.formatHdata({
                // "0x" is important, otherwise it won't work
                path: "buffer:0x" + buffer.id + "/own_lines/last_line(-" + numLines +
                    (protocolModule.mod.skipLines ? "," + buffer.requestedLines : "") + ")/data",
                keys: []
            })
        ).then(function(lineinfo) {
//XXX move to handlers?
            // delete old lines and add new ones
            var oldLines = buffer.lines.slice(0);
            var oldLength = oldLines.length;
            if (!protocolModule.mod.skipLines || oldLines === undefined) {
                oldLines = [];
            }
            // whether we already had all unread lines
            var hadAllUnreadLines = buffer.lastSeen >= 0;

            // clear the old lines
            buffer.lines.length = 0;
            // We need to set the number of requested lines to 0 here, because parsing a line
            // increments it. This is needed to also count newly arriving lines while we're
            // already connected.
            buffer.requestedLines = 0;
            // Count number of lines recieved
            var linesReceivedCount = lineinfo.objects[0].content.length + oldLines.length;

            // Parse the lines
            handlers.handleLineInfo(lineinfo, true);

            oldLines.forEach(function(message) {
                buffer.addLine(message);
                buffer.lastSeen++;
                buffer.requestedLines++;
            });

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
        fetchMoreLines: fetchMoreLines,
        requestNicklist: requestNicklist
    };
}]);
})();
