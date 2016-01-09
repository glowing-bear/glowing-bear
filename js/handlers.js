(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('handlers', ['$rootScope', '$log', 'models', 'plugins', 'notifications', function($rootScope, $log, models, plugins, notifications) {

    var handleVersionInfo = function(message) {
        var content = message.objects[0].content;
        var version = content.value;
        // Store the WeeChat version in models
        // this eats things like 1.3-dev -> [1,3]
        models.version = version.split(".").map(function(c) { return parseInt(c); });
    };

    var handleConfValue = function(message) {
        var infolist = message.objects[0].content;
        for (var i = 0; i < infolist.length ; i++) {
            var key, val;
            var item = infolist[i];
            for (var j = 0; j < item.length ; j++) {
                var confitem = item[j];
                if (confitem.full_name) {
                    key = confitem.full_name;
                }
                if (confitem.value) {
                    val = confitem.value;
                }
            }
            if (key && val) {
                $log.debug('Setting wconfig "' + key + '" to value "' + val + '"');
                models.wconfig[key] = val;
            }
        }
    };

    var handleBufferClosing = function(message) {
        var bufferMessage = message.objects[0].content[0];
        var bufferId = bufferMessage.pointers[0];
        models.closeBuffer(bufferId);
    };

    // inject a fake buffer line for date change if needed
    var injectDateChangeMessageIfNeeded = function(buffer, manually, old_date, new_date) {
        if (buffer.bufferType === 1) {
            // Don't add date change messages to free buffers
            return;
        }
        old_date.setHours(0, 0, 0, 0);
        new_date.setHours(0, 0, 0, 0);
        // Check if the date changed
        if (old_date.valueOf() !== new_date.valueOf()) {
            if (manually) {
                // if the message that caused this date change to be sent
                // would increment buffer.lastSeen, we should increment as
                // well.
                ++buffer.lastSeen;
            }
            var old_date_plus_one = old_date;
            old_date_plus_one.setDate(old_date.getDate() + 1);
            // it's not always true that a date with time 00:00:00
            // plus one day will be time 00:00:00
            old_date_plus_one.setHours(0, 0, 0, 0);

            var content = "\u001943"; // this colour corresponds to chat_day_change
            // Add day of the week
            if ($rootScope.supports_formatting_date) {
                content += new_date.toLocaleDateString(window.navigator.language,
                                                       {weekday: "long"});
            } else {
                // Gross code that only does English dates ew gross
                var dow_to_word = [
                    "Sunday", "Monday", "Tuesday",
                    "Wednesday", "Thursday", "Friday", "Saturday"];
                content += dow_to_word[new_date.getDay()];
            }
            // if you're testing different date formats,
            // make sure to test different locales such as "en-US",
            // "en-US-u-ca-persian" (which has different weekdays, year 0, and an ERA)
            // "ja-JP-u-ca-persian-n-thai" (above, diff numbering, diff text)
            var extra_date_format = {
                day: "numeric",
                month: "long"
            };
            if (new_date.getYear() !== old_date.getYear()) {
                extra_date_format.year = "numeric";
            }
            content += " (";
            if ($rootScope.supports_formatting_date) {
                content += new_date.toLocaleDateString(window.navigator.language,
                                                       extra_date_format);
            } else {
                // ew ew not more gross code
                var month_to_word = [
                    "January", "February", "March", "April",
                    "May", "June", "July", "August",
                    "September", "October", "November", "December"];
                content += month_to_word[new_date.getMonth()] + " " + new_date.getDate().toString();
                if (extra_date_format.year === "numeric") {
                    content += ", " + new_date.getFullYear().toString();
                }
            }
            // Result should be something like
            // Friday (November 27)
            // or if the year is different,
            // Friday (November 27, 2015)

            // Comparing dates in javascript is beyond tedious
            if (old_date_plus_one.valueOf() !== new_date.valueOf()) {
                var date_diff = Math.round((new_date - old_date)/(24*60*60*1000)) + 1;
                if (date_diff < 0) {
                    date_diff = -1*(date_diff);
                    if (date_diff === 1) {
                        content += ", 1 day before";
                    } else {
                        content += ", " + date_diff + " days before";
                    }
                } else {
                    content += ", " + date_diff + " days later";
                }
                // Result: Friday (November 27, 5 days later)
            }
            content += ")";

            var line = {
                buffer: buffer.id,
                date: new_date,
                prefix: '\u001943\u2500',
                tags_array: [],
                displayed: true,
                highlight: 0,
                message: content
            };
            var new_message = new models.BufferLine(line);
            buffer.addLine(new_message);
        }
    };

    var handleLine = function(line, manually) {
        var message = new models.BufferLine(line);
        var buffer = models.getBuffer(message.buffer);
        buffer.requestedLines++;
        // Only react to line if its displayed
        if (message.displayed) {
            // Check for date change
            if (buffer.lines.length > 0) {
                var old_date = new Date(buffer.lines[buffer.lines.length - 1].date),
                    new_date = new Date(message.date);
                injectDateChangeMessageIfNeeded(buffer, manually, old_date, new_date);
            }

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
        buffer.hidden = message.hidden;

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

        // After a buffer openes we get the name change event from relay protocol
        // Here we check our outgoing commands that openes a buffer and switch
        // to it if we find the buffer name it the list
        var position = models.outgoingQueries.indexOf(old.shortName);
        if (position >= 0) {
            models.outgoingQueries.splice(position, 1);
            models.setActiveBuffer(old.id);
        }
    };

    var handleBufferHidden = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);
        old.hidden = true;
    };

    var handleBufferUnhidden = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);
        old.hidden = false;
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
            // Update serverSortKey and related variables
            old.plugin = localvars.plugin;
            old.server = localvars.server;
            old.serverSortKey = old.plugin + "." + old.server +
                (old.type === "server" ? "" :  ("." + old.shortName));
        }
    };

    var handleBufferTypeChanged = function(message) {
        var obj = message.objects[0].content[0];
        var buffer = obj.pointers[0];
        var old = models.getBuffer(buffer);
        // 0 = formatted (normal); 1 = free
        buffer.bufferType = obj.type;
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
        if (message.objects[0].content.length > 0) {
            // fiddle out the buffer ID and take the last line's date
            var last_line =
                message.objects[0].content[message.objects[0].content.length-1];
            var buffer = models.getBuffer(last_line.buffer);
            if (buffer.lines.length > 0) {
                var last_date = new Date(buffer.lines[buffer.lines.length - 1].date);
                injectDateChangeMessageIfNeeded(buffer, true, last_date, new Date());
            }
        }
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
        _buffer_type_changed: handleBufferTypeChanged,
        _buffer_renamed: handleBufferRenamed,
        _buffer_hidden: handleBufferHidden,
        _buffer_unhidden: handleBufferUnhidden,
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
        handleConfValue: handleConfValue,
        handleEvent: handleEvent,
        handleLineInfo: handleLineInfo,
        handleHotlistInfo: handleHotlistInfo,
        handleNicklist: handleNicklist,
        handleBufferInfo: handleBufferInfo
    };

}]);
})();
