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
        var title = message.title;
        var number = message.number;
        var pointer = message.pointers[0];
        var local_variables = message.local_vars;
        var notify = 3; // Default 3 == message
        var lines = [];
        var requestedLines = 0;
        var nicklist = {};
        var flatnicklist = [];
        var history = [];
        var historyPos = 0;
        var active = false;
        var notification = 0;
        var unread = 0;
        var lastSeen = -1;
        var serverSortKey = fullName.replace(/^irc.server.(\w+)/, "irc.$1");
        var indent = (fullName.match(/^irc./) && !fullName.match(/^irc.server./));

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
        };

        /*
         * Adds a nick to nicklist
         */
        var addNick = function(group, nick) {
            nicklist[group].nicks.push(nick);
            flatnicklist = getFlatNicklist();
        };
        /*
         * Deletes a nick from nicklist
         */
        var delNick = function(group, nick) {
            group = nicklist[group];
            group.nicks = _.filter(group.nicks, function(n) { return n.name !== nick.name;});
            flatnicklist = getFlatNicklist();
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
            flatnicklist = getFlatNicklist();
        };

        /*
         * Maintain a cached version of a flat sorted nicklist
         *
         */
        var getFlatNicklist = function() {
            var newlist = [];
            _.each(nicklist, function(nickGroup) {
                _.each(nickGroup.nicks, function(nickObj) {
                    newlist.push(nickObj.name);
                });
            });
            newlist.sort(function(a, b) {
                return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
            });
            return newlist;
        };

        var flatNicklist = function() {
            return flatnicklist;
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
            if (historyPos < 0 || historyPos >= history.length) {
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

        return {
            id: pointer,
            fullName: fullName,
            shortName: shortName,
            number: number,
            title: title,
            lines: lines,
            requestedLines: requestedLines,
            addLine: addLine,
            lastSeen: lastSeen,
            unread: unread,
            notification: notification,
            localvars: local_variables,
            notify: notify,
            nicklist: nicklist,
            addNick: addNick,
            delNick: delNick,
            updateNick: updateNick,
            flatNicklist: flatNicklist,
            serverSortKey: serverSortKey,
            indent: indent,
            history: history,
            addToHistory: addToHistory,
            getHistoryUp: getHistoryUp,
            getHistoryDown: getHistoryDown
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
        if (content[0] !== undefined) {
            rtext = content[0].text;
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


    var BufferList = [];
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
        BufferList[buffer.id] = buffer;
        if (BufferList.length === 1) {
            activeBuffer = buffer;
        }
        this.model.buffers[buffer.id] = buffer;
    };

    this.getBufferByIndex  = function(index) {
        var i = 0;

        for (var v in BufferList) {
            if (index === ++i) {
                return BufferList[v];
            }
        }

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

        activeBuffer = _.find(this.model.buffers, function(buffer) {
            if (buffer[key] === bufferId) {
                return buffer;
            }
        });

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

        activeBuffer.active = true;
        activeBuffer.unread = 0;
        activeBuffer.notification = 0;

        $rootScope.$emit('activeBufferChanged');
        $rootScope.$emit('notificationChanged');
        return true;
    };

    /*
     * Returns the buffer list
     */
    this.getBuffers = function() {
        return BufferList;
    };

    /*
     * Returns a specific buffer object
     *
     * @param bufferId id of the buffer
     * @return the buffer object
     */
    this.getBuffer = function(bufferId) {
        return _.find(this.model.buffers, function(buffer) {
            if (buffer.id === bufferId) {
                return buffer;
            }
        });
    };

    /*
     * Closes a weechat buffer. Sets the first buffer
     * as active, if the closing buffer was active before
     *
     * @param bufferId id of the buffer to close
     * @return undefined
     */
    this.closeBuffer = function(bufferId) {
        var wasActive = this.model.buffers[bufferId.id].active;
        if (wasActive) {
            var firstBuffer = _.keys(this.model.buffers)[0];
            this.setActiveBuffer(firstBuffer);
        }
        delete(this.model.buffers[bufferId.id]);
    };
}]);
