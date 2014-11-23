(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('handlers', ['$rootScope', '$log', 'models', 'plugins', 'notifications', function($rootScope, $log, models, plugins, notifications) {

    var handleBufferClosing = function(message) {
        var bufferMessage = message.objects[0].content[0];
        var bufferId = bufferMessage.pointers[0];
        models.closeBuffer(bufferId);
    };

    var handleLine = function(line, manually) {
        var message = new models.BufferLine(line);
        var itembuffer = models.getTextBuffer(message.buffer);
        var buffer = itembuffer.textbuffer;
        buffer.requestedLines++;
        // Only react to line if its displayed
        if (message.displayed) {
            message = plugins.PluginManager.contentForMessage(message);
            itembuffer.addLine(message);

            if (manually) {
                buffer.lastSeen++;
            }

            if (buffer.active && !manually) {
                $rootScope.scrollWithBuffer();
            }

            if (!manually && (!buffer.active || !$rootScope.isWindowFocused())) {
                if (itembuffer.notify > 1 && _.contains(message.tags, 'notify_message') && !_.contains(message.tags, 'notify_none')) {
                    buffer.unread++;
                    $rootScope.$emit('notificationChanged');
                }

                if ((itembuffer.notify !== 0 && message.highlight) || _.contains(message.tags, 'notify_private')) {
                    buffer.notification++;
                    notifications.createHighlight(itembuffer, message);
                    $rootScope.$emit('notificationChanged');
                }
            }
        }
    };

    var handleLineInserted = function(line, previd) {
        var message = new models.BufferLine(line);
        var itembuffer = models.getTextBuffer(message.buffer);
        var buffer = itembuffer.textbuffer;
        // Only react to line if its displayed
        if (message.displayed) {
            message = plugins.PluginManager.contentForMessage(message);
            if (buffer.insertLine(message, previd)) {
                buffer.requestedLines++;
            }

            if (buffer.active) {
                $rootScope.scrollWithBuffer();
            }
        }
    };

    var handleLineRemoved = function(bufferid, lineid) {
        var buffer = (models.getTextBuffer(bufferid)||{}).textbuffer;
        if (buffer === undefined) { return; }
        if (buffer.removeLine(lineid)) {
            if (buffer.requestedLines > 0) {
                buffer.requestedLines--;
            }
        }
    };

    var handleBufferLineAdded = function(message) {
        message.objects[0].content.forEach(function(l) {
            handleLine(l, false);
        });
    };

    var handleBufferLineInserted = function(message) {
        var prevline = message.prevline;
        message.objects[0].content.forEach(function(l) {
            handleLineInserted(l, prevline, false);
            prevline = l.pointers[0];
        });
    };

    var handleBufferLineRemoved = function(message) {
        for (var buffer in message.lines) {
            for (var lineIdx in message.lines[buffer]) {
                handleLineRemoved(buffer, message.lines[buffer][lineIdx]);
            }
        }
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

    var handleBufferActivate = function(message) {
        var buffer = models.getTextBuffer(message.buffer);
        models.setActiveBuffer(buffer.id);
    };

    var handleBufferClearHotlist = function(message) {
        var buffer = models.getTextBuffer(message.buffer).textbuffer;
        buffer.unread = 0;
        buffer.notification = 0;

        // Trigger title and favico update
        $rootScope.$emit('notificationChanged');
    };

    var handleBufferTitleChanged = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);
        old.fullName = obj.full_name;
        old.title = obj.title;
        old.number = obj.number;
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

    var handleBufferItemActive = function(message) {
        var buffer = models.getBuffer(message.item);
        if (buffer === undefined) { return; } // does not exist (anymore)
        models.findTextbuffer(buffer.textbuffer.id);
        buffer.itemActive = true;
        if (buffer.textbuffer.active && !buffer.active) {
            models.setActiveBuffer(buffer.id);
        }
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
            var buffer = models.getTextBuffer(l.buffer).textbuffer;
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
            if (buffer === undefined) { // ignore, buffer doesn't exist
            } else if (n.group === 1) {
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
            if (buffer === undefined) { // ignore, buffer doesn't exist
            } else if (n.group === 1) {
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
                } else if (d === 64) { // @
                    buffer.updateNickChangegroup(group, nick);
                } else if (d === 33) { // !
                    buffer.delNickAllgroups(nick);
                } else if (d === 118) { // v
                    buffer.updateNickRename(n.oldname, n);
                }
            }
        });
    };

    var eventHandlers = {
        _buffer_closing: handleBufferClosing,
        _buffer_line_added: handleBufferLineAdded,
        _buffer_line_added_after: handleBufferLineInserted,
        _buffer_line_removed: handleBufferLineRemoved,
        _buffer_localvar_added: handleBufferLocalvarChanged,
        _buffer_localvar_removed: handleBufferLocalvarChanged,
        _buffer_opened: handleBufferOpened,
        _buffer_title_changed: handleBufferTitleChanged,
        _buffer_renamed: handleBufferRenamed,
        _buffer_item_active: handleBufferItemActive,
        _buffer_activate: handleBufferActivate,
        _buffer_clear_hotlist: handleBufferClearHotlist,
        _nicklist: handleNicklist,
        _nicklist_diff: handleNicklistDiff
    };

    $rootScope.$on('onMessage', function(event, message) {
        if (_.has(eventHandlers, message.id)) {
            eventHandlers[message.id](message);
        } else if (_.isEmpty(message)) { // ignore
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
        handleEvent: handleEvent,
        handleLineInfo: handleLineInfo,
        handleHotlistInfo: handleHotlistInfo,
        handleNicklist: handleNicklist
    };

}]);
})();
