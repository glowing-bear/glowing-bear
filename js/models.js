/*
 * This file contains the weechat models and various
 * helper methods to work with them.
 */
(function() {
'use strict';

var models = angular.module('weechatModels', []);

models.service('models', ['$rootScope', '$filter', 'protocolModule', function($rootScope, $filter, protocolModule) {
    var self = this;
    /*
     * Textbuffer class
     */
    this.Textbuffer = function(message) {
        var pointer = message.pointers[ protocolModule.mod.useTextbuffer ? 1 : 0 ];
        var number = message.number;
        var lines = [];
        var requestedLines = 0;
        var allLinesFetched = false;
        var history = [];
        var historyPos = 0;
        var notification = 0;
        var unread = 0;
        var lastSeen = -1;

        /*
         * Adds a line to this textbuffer
         *
         * @param line the BufferLine object
         * @return undefined
         */
        var addLine = function(line) {
            lines.push(line);
        };

        /*
         * Adds a line in the middle of this textbuffer
         *
         * @param line the BufferLine object
         * @param id the previous line id
         * @return whether line was added
         */
        var insertLineLastIdx;
        var insertLine = function(line, id) {
            if (this.allLinesFetched && id === null) {
                lines.unshift(line);
                return true;
            }
            var spliceafter;
            if (!insertLineLastIdx || insertLineLastIdx[id] === undefined) {
                for (var idx in lines) {
                    if (lines[idx].id === id) {
                        var idx_ = Number(idx);
                        insertLineLastIdx = {};
                        insertLineLastIdx[id] = idx_;
                        spliceafter = idx_;
                        break;
                    }
                }
            } else {
                spliceafter = insertLineLastIdx[id];
            }
            if (spliceafter !== undefined) {
                insertLineLastIdx[line.id] = spliceafter + 1;
                lines.splice(spliceafter + 1, 0, line);
                return true;
            }
            return false;
        };

        var removeLine = function(id) {
            for (var idx in lines) {
                if (lines[idx].id === id) {
                    lines.splice(idx, 1);
                    return true;
                }
            }
            return false;
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

        /* Clear all our buffer lines */
        var clear = function() {
            while(lines.length > 0) {
                lines.pop();
            }
            requestedLines = 0;
        };

        return {
            id: pointer,
            lines: lines,
            addLine: addLine,
            insertLine: insertLine,
            removeLine: removeLine,
            clear: clear,
            requestedLines: requestedLines,
            lastSeen: lastSeen,
            unread: unread,
            notification: notification,
            history: history,
            addToHistory: addToHistory,
            getHistoryUp: getHistoryUp,
            getHistoryDown: getHistoryDown
        };
    };

    this.model = { 'buffers': {} };

    /*
     * find textbuffer for a buffer message, creating it if necessary
     *
     * @param message buffer message
     * @return textbuffer
     */
    this.findTextbuffer = function(message) {
        var buffer;
        if (protocolModule.mod.useTextbuffer) {
            var id = 'object' === typeof message ? message.pointers[1] : message;
            _.each(this.model.buffers, function(itembuffer) {
                if (itembuffer.textbuffer.id == id) {
                    buffer = itembuffer.textbuffer;
                    itembuffer.itemActive = false;
                }
            });
        }
        if ('object' !== typeof message) { return buffer; }
        return (buffer || new this.Textbuffer(message));
    };

    /*
     * Buffer class
     */
    this.Buffer = function(message) {
        // weechat properties
        var fullName = message.full_name;
        var shortName = message.short_name;
        // just use a space if the rest of the channel name is empty ('#')
        var trimmedName = shortName.replace(/^[#&+]/, '') || ' ';
        // get channel identifier
        var prefix = ['#', '&', '+'].indexOf(shortName.charAt(0)) >= 0 ? shortName.charAt(0) : '';
        var title = message.title;
        var number = message.number;
        var pointer = message.pointers[0];
        var textbuffer = self.findTextbuffer(message);
        var notify = 3; // Default 3 == message
        var nicklist = {};
        var active = false;
        var itemActive = true;
        var serverSortKey = fullName.replace(/^irc\.server\.(\w+)/, "irc.$1");
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
            textbuffer.addLine(line);
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
         * Deletes a nick from anywhere in the nicklist
         */
        var delNickAllgroups = function(nick) {
            for (var g in nicklist) {
                delNick(g, nick);
            }
        };
        /*
         * Moves nick in nicklist to another group
         */
        var updateNickChangegroup = function(group, nick) {
            delNickAllgroups(nick);
            addNick(group, nick);
        };
        /*
         * Updates a nick in nicklist
         */
        var updateNickRename = function(oldname, nick) {
            for (var g in nicklist) {
                for(var i in nicklist[g].nicks) {
                    if (nicklist[g].nicks[i].name === oldname) {
                        nicklist[g].nicks[i] = nick;
                        return;
                    }
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
            var nick;
          if (line.fromnick !== undefined) {
            nick = line.fromnick;
            if (nick === false) {
                return;
            }
          } else {
            if (prefix.length === 0) {
                // some scripts produce lines without a prefix
                return;
            }
            nick = prefix[prefix.length - 1].text;
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

        var addToHistory = function(line) { return textbuffer.addToHistory(line); };
        var getHistoryUp = function(currentLine) { return textbuffer.getHistoryUp(currentLine); };
        var getHistoryDown = function(currentLine) { return textbuffer.getHistoryDown(currentLine); };

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
        var clear = function() { return textbuffer.clear(); };

        return {
            id: pointer,
            fullName: fullName,
            shortName: shortName,
            trimmedName: trimmedName,
            prefix: prefix,
            number: number,
            title: title,
            textbuffer: textbuffer,
            clear: clear,
            addLine: addLine,
            notify: notify,
            nicklist: nicklist,
            addNick: addNick,
            delNick: delNick,
            updateNick: updateNick,
            updateNickChangegroup: updateNickChangegroup,
            delNickAllgroups: delNickAllgroups,
            updateNickRename: updateNickRename,
            getNicklistByTime: getNicklistByTime,
            serverSortKey: serverSortKey,
            indent: indent,
            type: type,
            itemActive: itemActive,
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
        var fromnick = message.fromnick;
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
                var styles = {};
                var prefix;

                // foreground color
                if ('string' === typeof textEl.fgColor.name && textEl.fgColor.name.charAt(0) == '#') {
                    /*jshint -W069 */
                    styles['color'] = textEl.fgColor.name;
                    textEl.classes.push('ctf');
                    /*jshint +W069 */
                } else {
                    prefix = typeToClassPrefixFg[textEl.fgColor.type];
                    textEl.classes.push(prefix + textEl.fgColor.name);
                }

                // background color
                if ('string' === typeof textEl.bgColor.name && textEl.bgColor.name.charAt(0) == '#') {
                    styles['background-color'] = textEl.bgColor.name;
                    textEl.classes.push('ctb');
                } else {
                    prefix = typeToClassPrefixBg[textEl.bgColor.type];
                    textEl.classes.push(prefix + textEl.bgColor.name);
                }

                textEl.styles = styles;

                // attributes
                if (textEl.attrs.name !== null) {
                    textEl.classes.push('coa-' + textEl.attrs.name);
                }
                var val;
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

        var strtime;
        if (message.strtime !== undefined) {
            strtime = protocolModule.mod.rawText2Rich(message.strtime);
            addClasses(strtime);
        }

        var prefix = protocolModule.mod.rawText2Rich(message.prefix);
        addClasses(prefix);

        var tags_array = message.tags_array;
        var displayed = message.displayed;
        var highlight = message.highlight;
        var content = protocolModule.mod.rawText2Rich(message.message);
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

        var pointer = message.pointers[0];

        return {
            id: pointer,
            strtime: strtime,
            prefix: prefix,
            content: content,
            date: date,
            shortTime: shortTime,
            buffer: buffer,
            tags: tags_array,
            highlight: highlight,
            displayed: displayed,
            fromnick: fromnick,
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
            previousBuffer.textbuffer.active = false;
            // Save the last line we saw
            previousBuffer.textbuffer.lastSeen = previousBuffer.textbuffer.lines.length-1;
        }

        var unreadSum = activeBuffer.textbuffer.unread + activeBuffer.textbuffer.notification;

        this.findTextbuffer(activeBuffer.textbuffer.id);
        activeBuffer.active = true;
        activeBuffer.itemActive = true;
        activeBuffer.textbuffer.active = true;
        activeBuffer.textbuffer.unread = 0;
        activeBuffer.textbuffer.notification = 0;

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
     * Returns the buffer object which uses the specified textbuffer
     *
     * @param bufferId id of the textbuffer
     * @return the buffer object
     */
    this.getTextBuffer = function(bufferId) {
        if (protocolModule.mod.useTextbuffer) {
            var buffer = _.find(this.model.buffers, function(itembuffer) {
                if (itembuffer.textbuffer.id == bufferId && itembuffer.itemActive) {
                    return itembuffer;
                }
            });
            if (buffer === undefined) {
                buffer = _.find(this.model.buffers, function(itembuffer) {
                    if (itembuffer.textbuffer.id == bufferId) {
                        itembuffer.itemActive = true;
                        return itembuffer;
                    }
                });
            }
            return buffer;
        }
        return this.getBuffer(bufferId);
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
