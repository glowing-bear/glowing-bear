/*
 * This file contains the weechat models and various
 * helper methods to work with them.
 */
var models = angular.module('weechatModels', []);

models.service('models', ['$rootScope', '$filter', function($rootScope, $filter) {
    /*
     * Buffer class
     */
    this.Buffer = function(message) {
        // weechat properties
        var fullName = message.full_name;
        var shortName = message.short_name;
        var trimmedName = shortName.replace(/^[#&+]/, '');
        var title = message.title;
        var number = message.number;
        var pointer = message.pointers[0];
        var notify = 3; // Default 3 == message
        var lines = [];
        var requestedLines = 0;
        var allLinesFetched = false;
        var nicklist = {};
        var history = [];
        var historyPos = 0;
        var active = false;
        var notification = 0;
        var unread = 0;
        var lastSeen = -1;
        var serverSortKey = fullName.replace(/^irc.server.(\w+)/, "irc.$1");
        var type = message.local_variables.type;
        var indent = (['channel', 'private'].indexOf(type) >= 0);

        // Buffer opened message does not include notify level
        if (message.notify !== undefined) {
            notify = message.notify;
        }

        /*
         * Adds a line to this buffer
         *
         * @param line the BufferLine object
         * @return undefined
         */
        var addLine = function(line) {
            lines.push(line);
            updateNickSpeak(line);
        };

        /*
         * Adds a nick to nicklist
         */
        var addNick = function(group, nick) {
            if (nicklistRequested()) {
                nick.spokeAt = Date.now();
                nicklist[group].nicks.push(nick);
            }
        };
        /*
         * Deletes a nick from nicklist
         */
        var delNick = function(group, nick) {
            group = nicklist[group];
            if (group === undefined) {
                return;
            }
            group.nicks = _.filter(group.nicks, function(n) { return n.name !== nick.name;});
            /*
            for (i in group.nicks) {
                if (group.nicks[i].name == nick.name) {
                    delete group.nicks[i];
                    break;
                }
            }
            */
        };
        /*
         * Updates a nick in nicklist
         */
        var updateNick = function(group, nick) {
            group = nicklist[group];
            for(var i in group.nicks) {
                if (group.nicks[i].name === nick.name) {
                    group.nicks[i] = nick;
                    break;
                }
            }
        };

        /*
         * Update a nick with a fresh timestamp so tab completion
         * can use time to complete recent speakers
         */
        var updateNickSpeak = function(line) {
            // Try to find nick from prefix
            var prefix = line.prefix;
            if (prefix.length === 0) {
                // some scripts produce lines without a prefix
                return;
            }
            var nick = prefix[prefix.length - 1].text;
            // Action / me, find the nick as the first word of the message
            if (nick === " *") {
                var match = line.text.match(/^(.+)\s/);
                if (match) {
                    nick = match[1];
                }
            }
            else if (nick === "" || nick === "=!=") {
                return;
            }
            _.each(nicklist, function(nickGroup) {
                _.each(nickGroup.nicks, function(nickObj) {
                    if (nickObj.name === nick) {
                        // Use the order the line arrive in for simplicity
                        // instead of using weechat's own timestamp
                        nickObj.spokeAt = Date.now();
                    }
                });
            });
        };

        /*
         * Get a flat nicklist sorted by speaker time. This function is
         * called for every tab key press by the user.
         *
         */
        var getNicklistByTime = function() {
            var newlist = [];
            _.each(nicklist, function(nickGroup) {
                _.each(nickGroup.nicks, function(nickObj) {
                    newlist.push(nickObj);
                });
            });

            newlist.sort(function(a, b) {
                return a.spokeAt < b.spokeAt;
            });

            return newlist;
        };

        var addToHistory = function(line) {
            var result = "";
            if (historyPos !== history.length) {
                // Pop cached line from history. Occurs if we submit something from history
                result = history.pop();
            }
            history.push(line);
            historyPos = history.length;  // Go to end of history
            return result;
        };

        var getHistoryUp = function(currentLine) {
            if (historyPos >= history.length) {
                // cache current line in history
                history.push(currentLine);
            }
            if (historyPos <= 0 || historyPos >= history.length) {
                // Can't go up from first message or from out-of-bounds index
                return currentLine;
            } else {
                // Go up in history
                historyPos--;
                var line = history[historyPos];
                return line;
            }
        };

        var getHistoryDown = function(currentLine) {
            if (historyPos === history.length) {
                // stash on history like weechat does
                if (currentLine !== undefined && currentLine !== '') {
                    history.push(currentLine);
                    historyPos++;
                }
                return '';
            } else if (historyPos < 0 || historyPos > history.length) {
                // Can't go down from out of bounds or last message
                return currentLine;
            } else {
                historyPos++;

                if (history.length > 0 && historyPos == (history.length-1)) {
                    // return cached line and remove from cache
                    return history.pop();
                } else {
                    // Go down in history
                    return history[historyPos];
                }
            }
        };


        // Check if the nicklist is empty, i.e., no nicks present
        // This checks for the presence of people, not whether a
        // request for the nicklist has been made
        var isNicklistEmpty = function() {
            for (var obj in nicklist) {
                if (obj !== 'root') {
                    return false;
                }
            }
            return true;
        };

        var nicklistRequested = function() {
            // If the nicklist has been requested but is empty, it
            // still has a 'root' property. Check for its existence.
            return nicklist.hasOwnProperty('root');
        };

        /* Clear all our buffer lines */
        var clear = function() {
            while(lines.length > 0) {
                lines.pop();
            }
            requestedLines = 0;
        };

        return {
            id: pointer,
            fullName: fullName,
            shortName: shortName,
            trimmedName: trimmedName,
            number: number,
            title: title,
            lines: lines,
            clear: clear,
            requestedLines: requestedLines,
            addLine: addLine,
            lastSeen: lastSeen,
            unread: unread,
            notification: notification,
            notify: notify,
            nicklist: nicklist,
            addNick: addNick,
            delNick: delNick,
            updateNick: updateNick,
            getNicklistByTime: getNicklistByTime,
            serverSortKey: serverSortKey,
            indent: indent,
            type: type,
            history: history,
            addToHistory: addToHistory,
            getHistoryUp: getHistoryUp,
            getHistoryDown: getHistoryDown,
            isNicklistEmpty: isNicklistEmpty,
            nicklistRequested: nicklistRequested
        };

    };

    /*
     * BufferLine class
     */
    this.BufferLine = function(message) {
        var buffer = message.buffer;
        var date = message.date;
        var shortTime = $filter('date')(date, 'HH:mm');

        function addClasses(textElements) {
            var typeToClassPrefixFg = {
                'option': 'cof-',
                'weechat': 'cwf-',
                'ext': 'cef-'
            };
            var typeToClassPrefixBg = {
                'option': 'cob-',
                'weechat': 'cwb-',
                'ext': 'ceb-'
            };
            textElements.forEach(function(textEl) {
                textEl.classes = [];

                // foreground color
                var prefix = typeToClassPrefixFg[textEl.fgColor.type];
                textEl.classes.push(prefix + textEl.fgColor.name);

                // background color
                prefix = typeToClassPrefixBg[textEl.bgColor.type];
                textEl.classes.push(prefix + textEl.bgColor.name);

                // attributes
                if (textEl.attrs.name !== null) {
                    textEl.classes.push('coa-' + textEl.attrs.name);
                }
                for (var attr in textEl.attrs.override) {
                    val = textEl.attrs.override[attr];
                    if (val) {
                        textEl.classes.push('a-' + attr);
                    } else {
                        textEl.classes.push('a-no-' + attr);
                    }
                }
            });
        }


        var prefix = weeChat.Protocol.rawText2Rich(message.prefix);
        addClasses(prefix);

        var tags_array = message.tags_array;
        var displayed = message.displayed;
        var highlight = message.highlight;
        var content = weeChat.Protocol.rawText2Rich(message.message);
        addClasses(content);

        if (highlight) {
            prefix.forEach(function(textEl) {
                textEl.classes.push('highlight');
            });
        }

        var rtext = "";
        for (var i = 0; i < content.length; ++i) {
            rtext += content[i].text;
        }

       return {
            prefix: prefix,
            content: content,
            date: date,
            shortTime: shortTime,
            buffer: buffer,
            tags: tags_array,
            highlight: highlight,
            displayed: displayed,
            text: rtext

        };

    };

    function nickGetColorClasses(nickMsg, propName) {
        if (propName in nickMsg && nickMsg[propName] && nickMsg[propName].length > 0) {
            var color = nickMsg[propName];
            if (color.match(/^weechat/)) {
                // color option
                var colorName = color.match(/[a-zA-Z0-9_]+$/)[0];
                return [
                    'cof-' + colorName,
                    'cob-' + colorName,
                    'coa-' + colorName
                ];
            } else if (color.match(/^[a-zA-Z]+$/)) {
                // WeeChat color name
                return [
                    'cwf-' + color
                ];
            } else if (color.match(/^[0-9]+$/)) {
                // extended color
                return [
                    'cef-' + color
                ];
            }

        }

        return [
            'cwf-default'
        ];
    }

    function nickGetClasses(nickMsg) {
        return {
            'name': nickGetColorClasses(nickMsg, 'color'),
            'prefix': nickGetColorClasses(nickMsg, 'prefix_color')
        };
    }

    /*
     * Nick class
     */
    this.Nick = function(message) {
        var prefix = message.prefix;
        var visible = message.visible;
        var name = message.name;
        var colorClasses = nickGetClasses(message);

        return {
            prefix: prefix,
            visible: visible,
            name: name,
            prefixClasses: colorClasses.prefix,
            nameClasses: colorClasses.name
        };
    };
    /*
     * Nicklist Group class
     */
    this.NickGroup = function(message) {
        var name = message.name;
        var visible = message.visible;
        var nicks = [];

        return {
            name: name,
            visible: visible,
            nicks: nicks
        };
    };


    var activeBuffer = null;
    var previousBuffer = null;

    this.model = { 'buffers': {} };

    /*
     * Adds a buffer to the list
     *
     * @param buffer buffer object
     * @return undefined
     */
    this.addBuffer = function(buffer) {
        this.model.buffers[buffer.id] = buffer;
    };

    /*
     * Returns the current active buffer
     *
     * @return active buffer object
     */
    this.getActiveBuffer = function() {
        return activeBuffer;
    };

    /*
     * Returns the previous current active buffer
     *
     * @return previous buffer object
     */
    this.getPreviousBuffer = function() {
        return previousBuffer;
    };

    /*
     * Sets the buffer specifiee by bufferId as active.
     * Deactivates the previous current buffer.
     *
     * @param bufferId id of the new active buffer
     * @return true on success, false if buffer was not found
     */
    this.setActiveBuffer = function(bufferId, key) {
        if (key === undefined) {
            key = 'id';
        }

        previousBuffer = this.getActiveBuffer();

        if (key === 'id') {
            activeBuffer = this.model.buffers[bufferId];
        }
        else { 
            activeBuffer = _.find(this.model.buffers, function(buffer) {
                if (buffer[key] === bufferId) {
                    return buffer;
                }
            });
        }

        if (activeBuffer === undefined) {
            // Buffer not found, undo assignment
            activeBuffer = previousBuffer;
            return false;
        }

        if (previousBuffer) {
            // turn off the active status for the previous buffer
            previousBuffer.active = false;
            // Save the last line we saw
            previousBuffer.lastSeen = previousBuffer.lines.length-1;
        }

        var unreadSum = activeBuffer.unread + activeBuffer.notification;

        activeBuffer.active = true;
        activeBuffer.unread = 0;
        activeBuffer.notification = 0;

        $rootScope.$emit('activeBufferChanged', unreadSum);
        $rootScope.$emit('notificationChanged');
        return true;
    };

    /*
     * Returns the buffer list
     */
    this.getBuffers = function() {
        return this.model.buffers;
    };

    /*
     * Reinitializes the model
     */
    this.reinitialize = function() {
        this.model.buffers = {};
    };

    /*
     * Returns a specific buffer object
     *
     * @param bufferId id of the buffer
     * @return the buffer object
     */
    this.getBuffer = function(bufferId) {
        return this.model.buffers[bufferId];
    };

    /*
     * Closes a weechat buffer. Sets the first buffer
     * as active, if the closing buffer was active before
     *
     * @param bufferId id of the buffer to close
     * @return undefined
     */
    this.closeBuffer = function(bufferId) {
        var buffer = this.getBuffer(bufferId);
        // Check if the buffer really exists, just in case
        if (buffer === undefined) {
            return;
        }
        if (buffer.active) {
            var firstBuffer = _.keys(this.model.buffers)[0];
            this.setActiveBuffer(firstBuffer);
        }
        // Can't use `buffer` here, needs to be deleted from the list
        delete(this.model.buffers[bufferId]);
    };
}]);
