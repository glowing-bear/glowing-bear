(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('connection',
                ['$rootScope', '$log', 'handlers', 'models', 'settings', 'ngWebsockets', 'utils', function($rootScope,
         $log,
         handlers,
         models,
         settings,
         ngWebsockets,
         utils) {

    var protocol = new weeChat.Protocol();

    var connectionData = [];
    var reconnectTimer;

    // Global connection lock to prevent multiple connections from being opened
    var locked = false;

    // Takes care of the connection and websocket hooks
    var connect = function (host, port, path, passwd, ssl, useTotp, totp, noCompression, successCallback, failCallback) {
        $rootScope.passwordError = false;
        $rootScope.oldWeechatError = false;
        $rootScope.hashAlgorithmDisagree = false;
        connectionData = [host, port, path, passwd, ssl, noCompression];
        var proto = ssl ? 'wss' : 'ws';
        // If host is an IPv6 literal wrap it in brackets
        if (host.indexOf(":") !== -1 && host[0] !== "[" && host[host.length-1] !== "]") {
            host = "[" + host + "]";
        }
        var url = proto + "://" + host + ":" + port + "/" + path;
        $log.debug('Connecting to URL: ', url);


        var weechatAssumedPre2_9 = false;
        var onopen = function () {
            var _performHandshake = function() {
                return new Promise(function(resolve) {
                    // First a handshake is sent to determine authentication method
                    // This is only supported for weechat >= 2.9
                    // If after 'a while' weechat does not respond
                    // stop waiting for the handshake and assume it's an old version
                    // This time is debatable, high latency connections may wrongfully
                    // think weechat is an older version. This time is purposfully set
                    // too high, this time should be reduced if determined the weechat
                    // is lower than 2.9
                    // This time also includes the time it takes to generate the hash
                    const WAIT_TIME_OLD_WEECHAT = 200; //ms

                    // Wait long enough to assume we are on a version < 2.9
                    var handShakeTimeout = setTimeout(function () {
                        weechatAssumedPre2_9 = true;
                        console.log('Weechat\'s version is assumed to be < 2.9');
                        resolve();
                    }, WAIT_TIME_OLD_WEECHAT);

                    // Or wait for a response from the handshake
                    ngWebsockets.send(
                        weeChat.Protocol.formatHandshake({
                            password_hash_algo: "pbkdf2+sha512", compression: noCompression ? 'off' : 'zlib'
                        })
                    ).then(function (message){
                        clearTimeout(handShakeTimeout);
                        resolve(message);
                    });
                });
            };

            var _askTotp = function (useTotp) {
                return new Promise(function(resolve) {
                    // If weechat is < 2.9 the totp will be a setting (checkbox)
                    // Otherwise the handshake will specify it
                    if (useTotp) {
                        // Ask the user to input his TOTP
                        var totp = prompt("Please enter your TOTP Token");
                        resolve(totp);
                    } else {
                        // User does not use TOTP, don't ask
                        resolve(null);
                    }
                });
            };

            // Helper methods for initialization commands
            // This method is used to initialize weechat < 2.9
            var _initializeConnectionPre29 = function(passwd, totp) {
                // This is not secure, this has to be specifically allowed with a setting
                // Otherwise an attacker could persuade the client to send it's password
                // Or due to latency the client could think weechat was an older version
                if (!settings.compatibilityWeechat28) {
                    $rootScope.oldWeechatError = true;
                    $rootScope.$emit('relayDisconnect');
                    $rootScope.$digest(); // Have to do this otherwise change detection doesn't see the error.
                    throw new Error('Plaintext authentication not allowed.');
                }

                // Escape comma in password (#937)
                passwd = passwd.replace(',', '\\,');

                ngWebsockets.send(
                    weeChat.Protocol.formatInitPre29({
                        password: passwd,
                        compression: noCompression ? 'off' : 'zlib',
                        totp: totp
                    })
                );

                // Wait a little bit until the init is sent
                return new Promise(function(resolve) {
                    setTimeout(function() { resolve(); }, 5);
                });

            };

            // Helper methods for initialization commands
            // This method is used to initialize weechat >= 2.9
            var salt;
            var _initializeConnection29 = function(passwd, nonce, iterations, totp) {
                return window.crypto.subtle.importKey(
                    'raw',
                    utils.stringToUTF8Array(passwd),
                    {name: 'PBKDF2'},//{name: 'HMAC', hash: 'SHA-512'},
                    false,
                    ['deriveBits']
                ).then(function (key) {
                    var clientnonce = window.crypto.getRandomValues(new Uint8Array(16));
                    //nonce:clientnonce, 3A is a ':' in ASCII
                    salt = utils.concatenateTypedArrays(
                        nonce, new Uint8Array([0x3A]), clientnonce);
                    return window.crypto.subtle.deriveBits(
                        {
                            name: 'PBKDF2',
                            hash: 'SHA-512',
                            salt: salt,
                            iterations: iterations,
                        }, key, 512
                    );
                }).then(function (hash) {
                    ngWebsockets.send(
                        weeChat.Protocol.formatInit29(
                            'pbkdf2+sha512:' + utils.bytetoHexString(salt) + ':' +
                                iterations + ':' + utils.bytetoHexString(hash),
                            totp
                        )
                    );

                    // Wait a little bit until the init is sent
                    return new Promise(function(resolve) {
                        setTimeout(function() { resolve(); }, 5);
                    });
                });
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
                        keys: ['local_variables,notify,number,full_name,short_name,title,hidden,type']
                    })
                );
            };

            var _requestSync = function() {
                return ngWebsockets.send(
                    weeChat.Protocol.formatSync({})
                );
            };

            var _parseWeechatTimeFormat = function() {
                // helper function to get a custom delimiter span
                var _timeDelimiter = function(delim) {
                    return "'<span class=\"cof-chat_time_delimiters cob-chat_time_delimiters coa-chat_time_delimiters\">" + delim + "</span>'";
                };

                // Fetch the buffer time format from weechat
                var timeFormat = models.wconfig['weechat.look.buffer_time_format'];

                // Weechat uses strftime, with time specifiers such as %I:%M:%S for 12h time
                // The time formatter we use, AngularJS' date filter, uses a different format
                // Where %I:%M:%S would be represented as hh:mm:ss
                // Here, we detect what format the user has set in Weechat and slot it into
                // one of four formats, (short|long) (12|24)-hour time
                var angularFormat = "";

                var timeDelimiter = _timeDelimiter(":");

                var left12 = "hh" + timeDelimiter + "mm";
                var right12 = "'&nbsp;'a";

                var short12 = left12 + right12;
                var long12 = left12 + timeDelimiter + "ss" + right12;

                var short24 = "HH" + timeDelimiter + "mm";
                var long24 = short24 + timeDelimiter + "ss";

                if (timeFormat.indexOf("%H") > -1 ||
                    timeFormat.indexOf("%k") > -1) {
                    // 24h time detected
                    if (timeFormat.indexOf("%S") > -1) {
                        // show seconds
                        angularFormat = long24;
                    } else {
                        // don't show seconds
                        angularFormat = short24;
                    }
                } else if (timeFormat.indexOf("%I") > -1 ||
                           timeFormat.indexOf("%l") > -1 ||
                           timeFormat.indexOf("%p") > -1 ||
                           timeFormat.indexOf("%P") > -1) {
                    // 12h time detected
                    if (timeFormat.indexOf("%S") > -1) {
                        // show seconds
                        angularFormat = long12;
                    } else {
                        // don't show seconds
                        angularFormat = short12;
                    }
                } else if (timeFormat.indexOf("%r") > -1) {
                    // strftime doesn't have an equivalent for short12???
                    angularFormat = long12;
                } else if (timeFormat.indexOf("%T") > -1) {
                    angularFormat = long24;
                } else if (timeFormat.indexOf("%R") > -1) {
                    angularFormat = short24;
                } else {
                    angularFormat = short24;
                }

                // Assemble date format
                var date_components = [];

                // Check for day of month in time format
                var day_pos = Math.max(timeFormat.indexOf("%d"),
                                       timeFormat.indexOf("%e"));
                date_components.push([day_pos, "dd"]);

                // month of year?
                var month_pos = timeFormat.indexOf("%m");
                date_components.push([month_pos, "MM"]);

                // year as well?
                var year_pos = Math.max(timeFormat.indexOf("%y"),
                                        timeFormat.indexOf("%Y"));
                if (timeFormat.indexOf("%y") > -1) {
                    date_components.push([year_pos, "yy"]);
                } else if (timeFormat.indexOf("%Y") > -1) {
                    date_components.push([year_pos, "yyyy"]);
                }

                // if there is a date, assemble it in the right order
                date_components.sort();
                var format_array = [];
                for (var i = 0; i < date_components.length; i++) {
                    if (date_components[i][0] == -1) continue;
                    format_array.push(date_components[i][1]);
                }
                if (format_array.length > 0) {
                    // TODO: parse delimiter as well? For now, use '/' as it is
                    // more common internationally than '-'
                    var date_format = format_array.join(_timeDelimiter("/"));
                    angularFormat = date_format + _timeDelimiter("&nbsp;") + angularFormat;
                }

                $rootScope.angularTimeFormat = angularFormat;
            };

            var passwordMethod;
            var totpRequested;
            var nonce;
            var iterations;

            _performHandshake().then(
                // Wait for weechat to respond or handshake times out
                function (message) {
                    // Do nothing if the handshake was received
                    // after concluding weechat was an old version
                    // TODO maybe warn the user here
                    if (weechatAssumedPre2_9) {
                        return;
                    }

                    var content = message.objects[0].content;
                    passwordMethod = content.password_hash_algo;
                    totpRequested = (content.totp === 'on');
                    nonce = utils.hexStringToByte(content.nonce);
                    iterations = content.password_hash_iterations;

                    if (passwordMethod != "pbkdf2+sha512") {
                        $rootScope.hashAlgorithmDisagree = true;
                        $rootScope.$emit('relayDisconnect');
                        $rootScope.$digest(); // Have to do this otherwise change detection doesn't see the error.
                        throw new Error('No supported password hash algorithm returned.');
                    }
                }
            ).then(function() {
                if (weechatAssumedPre2_9) {
                    // Ask the user for the TOTP token if this is enabled
                    return _askTotp(useTotp)
                    .then(function (totp) {
                        return _initializeConnectionPre29(passwd, totp);
                    });
                } else {
                    // Weechat version >= 2.9
                    return _askTotp(totpRequested)
                    .then(function(totp) {
                        return _initializeConnection29(passwd, nonce, iterations, totp);
                    });
                }
            }).then(function(){
                // The Init was sent, weechat will not respond
                // Wait until either the connection closes
                // Or try to send version and see if weechat responds
                return ngWebsockets.send(
                    weeChat.Protocol.formatInfo({
                        name: 'version'
                    })
                );
            }).then(function(version) {
                // From now on we are assumed initialized
                // We don't know for sure because weechat does not respond
                // All we know is the socket wasn't closed afer waiting a little bit
                console.log('Succesfully connected');
                $rootScope.waseverconnected = true;
                handlers.handleVersionInfo(version);

                // Send all the other commands required for initialization
                _requestBufferInfos().then(function(bufinfo) {
                    handlers.handleBufferInfo(bufinfo);
                });

                _requestHotlist().then(function(hotlist) {
                    handlers.handleHotlistInfo(hotlist);

                });
                if (settings.hotlistsync) {
                    // Schedule hotlist syncing every so often so that this
                    // client will have unread counts (mostly) in sync with
                    // other clients or terminal usage directly.
                    setInterval(function() {
                        if ($rootScope.connected) {
                            _requestHotlist().then(function(hotlist) {
                                handlers.handleHotlistInfo(hotlist);

                            });
                        }
                    }, 60000); // Sync hotlist every 60 second
                }

                // Fetch weechat time format for displaying timestamps
                fetchConfValue('weechat.look.buffer_time_format',
                                function() {
                                    // Will set models.wconfig['weechat.look.buffer_time_format']
                                    _parseWeechatTimeFormat();
                });

                // Fetch nick completion config
                fetchConfValue('weechat.completion.nick_completer');
                fetchConfValue('weechat.completion.nick_add_space');

                _requestSync();
                $log.info("Connected to relay");
                $rootScope.connected = true;
                if (successCallback) {
                    successCallback();
                }

            },
            
            //Sending version failed
            function() {
                handleWrongPassword();
            });
        };

        var onclose = function (evt) {
            /*
             * Handles websocket disconnection
             */
            $log.info("Disconnected from relay");
            $rootScope.$emit('relayDisconnect');
            locked = false;
            if ($rootScope.userdisconnect || !$rootScope.waseverconnected) {
                handleClose(evt);
                $rootScope.userdisconnect = false;
            } else {
                reconnect(evt);
            }
            handleWrongPassword();
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

        var handleWrongPassword = function() {
            // Connection got closed, lets check if we ever was connected successfully
            if (!$rootScope.waseverconnected && !$rootScope.errorMessage &&
                !$rootScope.oldWeechatError && !$rootScope.hashAlgorithmDisagree)
            {
                $rootScope.passwordError = true;
                $rootScope.$apply();
            }
        };

        var onerror = function (evt) {
            /*
             * Handles cases when connection issues come from
             * the relay.
             */
            $log.error("Relay error", evt);
            locked = false;  // release connection lock
            $rootScope.lastError = Date.now();

            if (evt.type === "error" && this.readyState !== 1) {
                ngWebsockets.failCallbacks('error');
                $rootScope.errorMessage = true;
            }
        };

        if (locked) {
            // We already have an open connection
            $log.debug("Aborting connection (lock in use)");
        }
        // Kinda need a compare-and-swap here...
        locked = true;

        try {
            ngWebsockets.connect(url,
                     protocol,
                     {
                         'binaryType': "arraybuffer",
                         'onopen': onopen,
                         'onclose': onclose,
                         'onerror': onerror
                     });
        } catch(e) {
            locked = false;
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
        // won't work if totp is mandatory
        if (settings.useTotp)
        {
            $log.info('Not reconnecting because totp will be expired.');
            return;
        }

        $log.info('Attempting to reconnect...');
        var d = connectionData;
        connect(d[0], d[1], d[2], d[3], d[4], false, "", d[5], function() {
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
            locked = false;  // release the connection lock
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
        if (models.version[0] >= 1) {
            // WeeChat >= 1 supports clearing hotlist with this command
            sendMessage('/buffer set hotlist -1');
            // Also move read marker
            sendMessage('/input set_unread_current_buffer');
        } else {
            // If user wants to sync hotlist with weechat
            // we will send a /buffer bufferName command every time
            // the user switches a buffer. This will ensure that notifications
            // are cleared in the buffer the user switches to
            sendCoreCommand('/buffer ' + models.getActiveBuffer().fullName);
        }
    };

    var sendHotlistClearAll = function() {
        sendMessage("/input hotlist_clear");
    };

    var requestNicklist = function(bufferId, callback) {
        // Prevent requesting nicklist for all buffers if bufferId is invalid
        if (!bufferId) {
            return;
        }
        ngWebsockets.send(
            weeChat.Protocol.formatNicklist({
                buffer: "0x"+bufferId
            })
        ).then(function(nicklist) {
            handlers.handleNicklist(nicklist);
            if (callback !== undefined) {
                callback();
            }
        });
    };

    var fetchConfValue = function(name, callback) {
        ngWebsockets.send(
            weeChat.Protocol.formatInfolist({
                name: "option",
                pointer: 0,
                args: name
            })
        ).then(function(i) {
            handlers.handleConfValue(i);
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
        sendHotlistClearAll: sendHotlistClearAll,
        fetchMoreLines: fetchMoreLines,
        requestNicklist: requestNicklist,
        attemptReconnect: attemptReconnect
    };
}]);
})();
