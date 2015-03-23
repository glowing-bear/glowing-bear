(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('handlers', ['$rootScope', '$log', 'models', 'plugins', 'notifications', function($rootScope, $log, models, plugins, notifications) {

    var handleVersionInfo = function(message) {
        var content = message.objects[0].content;
        var version = content.value;
        // Store the WeeChat version in models
        models.version = version;
    };

    var handleBufferClosing = function(message) {
        var bufferMessage = message.objects[0].content[0];
        var bufferId = bufferMessage.pointers[0];
        models.closeBuffer(bufferId);
    };

    var handleLine = function(line, manually) {
        var message = new models.BufferLine(line);
        var buffer = models.getBuffer(message.buffer);
        buffer.requestedLines++;
        // Only react to line if its displayed
        if (message.displayed) {
            message = plugins.PluginManager.contentForMessage(message);
            buffer.addLine(message);

            if (manually) {
                buffer.lastSeen++;
            }

            if (buffer.active && !manually) {
                $rootScope.scrollWithBuffer();
            }

            if (!manually && (!buffer.active || !$rootScope.isWindowFocused())) {
                if (buffer.notify > 1 && _.contains(message.tags, 'notify_message') && !_.contains(message.tags, 'notify_none')) {
                    buffer.unread++;
                    $rootScope.$emit('notificationChanged');
                }

                if ((buffer.notify !== 0 && message.highlight) || _.contains(message.tags, 'notify_private')) {
                    buffer.notification++;
                    notifications.createHighlight(buffer, message);
                    $rootScope.$emit('notificationChanged');
                }
            }
        }
    };

    var handleBufferInfo = function(message) {
        var bufferInfos = message.objects[0].content;
        // buffers objects
        for (var i = 0; i < bufferInfos.length ; i++) {
            var bufferId = bufferInfos[i].pointers[0];
            var buffer = models.getBuffer(bufferId);
            if (buffer !== undefined) {
                // We already know this buffer
                handleBufferUpdate(buffer, bufferInfos[i]);
            } else {
                buffer = new models.Buffer(bufferInfos[i]);
                models.addBuffer(buffer);
                // Switch to first buffer on startup
                if (i === 0) {
                    models.setActiveBuffer(buffer.id);
                }
            }
        }
    };

    var handleBufferUpdate = function(buffer, message) {
        if (message.pointers[0] !== buffer.id) {
            // this is information about some other buffer!
            return;
        }

        // weechat properties -- short name can be changed
        buffer.shortName = message.short_name;
        buffer.trimmedName = buffer.shortName.replace(/^[#&+]/, '');
        buffer.title = message.title;
        buffer.number = message.number;

        // reset these, hotlist info will arrive shortly
        buffer.notification = 0;
        buffer.unread = 0;
        buffer.lastSeen = -1;

        if (message.local_variables.type !== undefined) {
            buffer.type = message.local_variables.type;
            buffer.indent = (['channel', 'private'].indexOf(buffer.type) >= 0);
        }

        if (message.notify !== undefined) {
            buffer.notify = message.notify;
        }
    };

    var handleBufferLineAdded = function(message) {
        message.objects[0].content.forEach(function(l) {
            handleLine(l, false);
        });
    };

    var handleBufferOpened = function(message) {
        var bufferMessage = message.objects[0].content[0];
        var buffer = new models.Buffer(bufferMessage);
        models.addBuffer(buffer);
        /* Until we can decide if user asked for this buffer to be opened
         * or not we will let user click opened buffers.
        models.setActiveBuffer(buffer.id);
        */
    };

    var handleBufferTitleChanged = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);
        old.fullName = obj.full_name;
        old.title = models.parseRichText(obj.title);
        old.number = obj.number;

        old.rtitle = "";
        for (var i = 0; i < old.title.length; ++i) {
            old.rtitle += old.title[i].text;
        }
    };

    var handleBufferRenamed = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);
        old.fullName = obj.full_name;
        old.shortName = obj.short_name;
        // If it's a channel, trim away the prefix (#, &, or +). If that is empty and the buffer
        // has a short name, use a space (because the prefix will be displayed separately, and we don't want
        // prefix + fullname, which would happen otherwise). Else, use null so that full_name is used
        old.trimmedName = obj.short_name.replace(/^[#&+]/, '') || (obj.short_name ? ' ' : null);
        old.prefix = ['#', '&', '+'].indexOf(obj.short_name.charAt(0)) >= 0 ? obj.short_name.charAt(0) : '';
    };

    var handleBufferLocalvarChanged = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);

        var localvars = obj.local_variables;
        if (old !== undefined && localvars !== undefined) {
            // Update indentation status
            old.type = localvars.type;
            old.indent = (['channel', 'private'].indexOf(localvars.type) >= 0);
        }
    };

    /*
     * Handle answers to (lineinfo) messages
     *
     * (lineinfo) messages are specified by this client. It is request after bufinfo completes
     */
    var handleLineInfo = function(message, manually) {
        var lines = message.objects[0].content.reverse();
        if (manually === undefined) {
            manually = true;
        }
        lines.forEach(function(l) {
            handleLine(l, manually);
        });
    };

    /*
     * Handle answers to hotlist request
     */
    var handleHotlistInfo = function(message) {
        if (message.objects.length === 0) {
            return;
        }
        var hotlist = message.objects[0].content;
        hotlist.forEach(function(l) {
            var buffer = models.getBuffer(l.buffer);
            // 1 is message
            buffer.unread += l.count[1];
            // 2 is private
            buffer.notification += l.count[2];
            // 3 is highlight
            buffer.notification += l.count[3];
            /* Since there is unread messages, we can guess
            * what the last read line is and update it accordingly
            */
            var unreadSum = _.reduce(l.count, function(memo, num) { return memo + num; }, 0);
            buffer.lastSeen = buffer.lines.length - 1 - unreadSum;
        });
    };

    /*
     * Handle nicklist event
     */
    var handleNicklist = function(message) {
        var nicklist = message.objects[0].content;
        var group = 'root';
        nicklist.forEach(function(n) {
            var buffer = models.getBuffer(n.pointers[0]);
            if (n.group === 1) {
                var g = new models.NickGroup(n);
                group = g.name;
                buffer.nicklist[group] = g;
            } else {
                var nick = new models.Nick(n);
                buffer.addNick(group, nick);
            }
        });
    };
    /*
     * Handle nicklist diff event
     */
    var handleNicklistDiff = function(message) {
        var nicklist = message.objects[0].content;
        var group;
        nicklist.forEach(function(n) {
            var buffer = models.getBuffer(n.pointers[0]);
            var d = n._diff;
            if (n.group === 1) {
                group = n.name;
                if (group === undefined) {
                    var g = new models.NickGroup(n);
                    buffer.nicklist[group] = g;
                    group = g.name;
                }
            } else {
                var nick = new models.Nick(n);
                if (d === 43) { // +
                    buffer.addNick(group, nick);
                } else if (d === 45) { // -
                    buffer.delNick(group, nick);
                } else if (d === 42) { // *
                    buffer.updateNick(group, nick);
                }
            }
        });
    };

    var eventHandlers = {
        _buffer_closing: handleBufferClosing,
        _buffer_line_added: handleBufferLineAdded,
        _buffer_localvar_added: handleBufferLocalvarChanged,
        _buffer_localvar_removed: handleBufferLocalvarChanged,
        _buffer_localvar_changed: handleBufferLocalvarChanged,
        _buffer_opened: handleBufferOpened,
        _buffer_title_changed: handleBufferTitleChanged,
        _buffer_renamed: handleBufferRenamed,
        _nicklist: handleNicklist,
        _nicklist_diff: handleNicklistDiff
    };

    $rootScope.$on('onMessage', function(event, message) {
        if (_.has(eventHandlers, message.id)) {
            eventHandlers[message.id](message);
        } else {
            $log.debug('Unhandled event received: ' + message.id);
        }
    });

    var handleEvent = function(event) {
        if (_.has(eventHandlers, event.id)) {
            eventHandlers[event.id](event);
        }
    };

    return {
        handleVersionInfo: handleVersionInfo,
        handleEvent: handleEvent,
        handleLineInfo: handleLineInfo,
        handleHotlistInfo: handleHotlistInfo,
        handleNicklist: handleNicklist,
        handleBufferInfo: handleBufferInfo
    };

}]);
})();
