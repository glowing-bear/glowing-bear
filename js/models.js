/*
 * This file contains the weechat models and various
 * helper methods to work with them.
 */
(function() {
'use strict';

var models = angular.module('weechatModels', []);

models.service('models', ['$rootScope', '$filter', function($rootScope, $filter) {
    // WeeChat version
    this.version = null;

    var parseRichText = function(text) {
        var textElements = weeChat.Protocol.rawText2Rich(text),
            typeToClassPrefixFg = {
                'option': 'cof-',
                'weechat': 'cwf-',
                'ext': 'cef-'
            },
            typeToClassPrefixBg = {
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
            var attr, val;
            for (attr in textEl.attrs.override) {
                val = textEl.attrs.override[attr];
                if (val) {
                    textEl.classes.push('a-' + attr);
                } else {
                    textEl.classes.push('a-no-' + attr);
                }
            }
        });
        return textElements;
    };
    this.parseRichText = parseRichText;

    /*
     * Buffer class
     */
    this.Buffer = function(message) {
        // weechat properties
        var fullName = message.full_name;
        var shortName = message.short_name;
        // If it's a channel, trim away the prefix (#, &, or +). If that is empty and the buffer
        // has a short name, use a space (because the prefix will be displayed separately, and we don't want
        // prefix + fullname, which would happen otherwise). Else, use null so that full_name is used
        var trimmedName = shortName.replace(/^[#&+]/, '') || (shortName ? ' ' : null);
        // get channel identifier
        var prefix = ['#', '&', '+'].indexOf(shortName.charAt(0)) >= 0 ? shortName.charAt(0) : '';
        var title = parseRichText(message.title);
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
        var serverSortKey = fullName.replace(/^irc\.server\.(\w+)/, "irc.$1");
        var type = message.local_variables.type;
        var indent = (['channel', 'private'].indexOf(type) >= 0);

        // Buffer opened message does not include notify level
        if (message.notify !== undefined) {
            notify = message.notify;
        }

        var rtitle = "";
        for (var i = 0; i < title.length; ++i) {
            rtitle += title[i].text;
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
            if (group === undefined) {
                // We are getting nicklist events for a buffer where not yet
                // have populated the nicklist, so there will be nothing to
                // update. Just ignore the event.
                return;
            }
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
            prefix: prefix,
            number: number,
            title: title,
            rtitle: rtitle,
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

        var prefix = parseRichText(message.prefix);
        var tags_array = message.tags_array;
        var displayed = message.displayed;
        var highlight = message.highlight;
        var content = parseRichText(message.message);

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

    /*
     * Buffer switch history
     */
    this.History = function() {
        // The buffer history. Pointers are converted to ints to save space.
        // This means that we can definitely save the entire history and not
        // consume absurd amounts of memory, unlike UTF-16 strings of len ≥ 7
        var history = [];
        var position = -1;
        var firstSmartJump = -1;
        var lastActionOffset = +1; // last is initially forward

        var _return = function(bufferId) {
            return bufferId.toString(16);
        };

        var getFirstSmartJump = function() {
            return _return(history[firstSmartJump]);
        };

        var resetSmartJump = function() {
            firstSmartJump = history.length - 1;
        };

        var smartJump = function() {
            firstSmartJump--;
        };

        var getPrevNextBuffer = function(next) {
            if (next && position < history.length - 1) {
                return _return(history[position + 1]);
            } else if (!next && position > 0) {
                return _return(history[position - 1]);
            }
        };

        var getLastDisplayedBuffer = function() {
            var newPosition = position - lastActionOffset;
            if (newPosition >= 0 && newPosition < history.length) {
                return _return(newPosition);
            }
        };

        var switchToLastBuffer = function() {
            lastActionOffset = -lastActionOffset;
            position += lastActionOffset;
        };

        var moveInHistory = function(forward) {
            lastActionOffset = forward ? +1 : -1;
            position += lastActionOffset;
        };

        var recordBufferSwitch = function(buffer) {
            // save buffer pointer as int
            history.push(parseInt("0x" + buffer.id));
            firstSmartJump++;
            position++;
            lastActionOffset = +1;
        };

        var get = function() {
            return {position: position, firstSmartJump: firstSmartJump, history: history};
        };

        return {
            getFirstSmartJump: getFirstSmartJump,
            resetSmartJump: resetSmartJump,
            smartJump: smartJump,
            getPrevNextBuffer: getPrevNextBuffer,
            moveInHistory: moveInHistory,
            getLastDisplayedBuffer: getLastDisplayedBuffer,
            switchToLastBuffer: switchToLastBuffer,
            recordBufferSwitch: recordBufferSwitch,
            get: get
        };
    };


    var activeBuffer = null;
    var previousBuffer = null;
    var history = this.History();

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
     * Sets the buffer specifiee by bufferId as active.
     * Deactivates the previous current buffer.
     *
     * @param bufferId id of the new active buffer
     * @return true on success, false if buffer was not found
     */
    this.setActiveBuffer = function(bufferId, key, isMoveInHistory) {
        if (!key) {
            key = 'id';
        }

        previousBuffer = this.getActiveBuffer();

        if (key === 'id') {
            activeBuffer = this.model.buffers[bufferId];
        } else {
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

        if (!isMoveInHistory) {
            history.recordBufferSwitch(activeBuffer);
        }

        $rootScope.$emit('activeBufferChanged', unreadSum);
        $rootScope.$emit('notificationChanged');
        return true;
    };

    this.switchToActivityBuffer = function() {
        var that = this;
        var jumpTo = function(bufferId) {
            that.setActiveBuffer(bufferId);
            history.smartJump();
        };

        // Find next buffer with activity and switch to it
        var sortedBuffers = _.sortBy(this.getBuffers(), 'number');
        var i, buffer;
        // Look for a buffer with notifications or unread message
        var unreadBuffer = null;
        for (i in sortedBuffers) {
            buffer = sortedBuffers[i];
            if (buffer.notification > 0) {
                jumpTo(buffer.id);
                return;
            }

            if (buffer.unread > 0 && !unreadBuffer) {
                unreadBuffer = buffer;
            }
        }

        if (unreadBuffer) {
            jumpTo(unreadBuffer.id);
            return;
        }

        // Jump back to first buffer in the series
        this.setActiveBuffer(history.getFirstSmartJump());
        history.resetSmartJump();
    };

    this.switchToPrevNextBuffer = function(forward) {
        var newBufferId = history.getPrevNextBuffer(forward);
        if (newBufferId) {
            this.setActiveBuffer(newBufferId, null, true);
            history.moveInHistory(forward);
            return true;
        }
        return false;
    };

    this.switchToLastBuffer = function() {
        var lastBufferId = history.getLastDisplayedBuffer();
        if (lastBufferId) {
            this.setActiveBuffer(lastBufferId, null, true);
            history.switchToLastBuffer();
            return true;
        }
        return false;
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
})();
