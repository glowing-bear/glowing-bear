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
        var fullName = message['full_name']
        var shortName = message['short_name']
        var title = message['title']
        var number = message['number']
        var pointer = message['pointers'][0]
        var local_variables = message['local_vars'];
        var notify = 3 // Default 3 == message
        var lines = []
        var nicklist = {} 
        var active = false
        var notification = 0 
        var unread = 0
        var lastSeen = -2

        // Buffer opened message does not include notify level
        if( message['notify'] != undefined ) {
            notify = message['notify'];
        }

        /*
         * Adds a line to this buffer
         * 
         * @param line the BufferLine object
         * @return undefined
         */
        var addLine = function(line) {
            lines.push(line);
        }

        /*
         * Adds a nick to nicklist
         */
        var addNick = function(nick) {
        }

        return {
            id: pointer,
            fullName: fullName,
            shortName: shortName,
            number: number,
            title: title,
            lines: lines,
            addLine: addLine,
            lastSeen: lastSeen,
            unread: unread,
            notification: notification,
            localvars: local_variables,
            notify: notify,
            nicklist: nicklist
        }

    }
    
    /*
     * BufferLine class
     */
    this.BufferLine = function(message) {
        var buffer = message['buffer'];
        var date = message['date'];
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


        var prefix = weeChat.Protocol.rawText2Rich(message['prefix']);
        addClasses(prefix);

        var tags_array = message['tags_array'];
        var displayed = message['displayed'];
        var highlight = message['highlight'];
        var content = weeChat.Protocol.rawText2Rich(message['message']);
        addClasses(content);

        var rtext = "";
        if(content[0] != undefined) {
            rtext = content[0]['text'];
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
            text: rtext,

        }

    }    
    /*
     * Nick class
     */
    this.Nick = function(message) {
        var prefix = message['prefix'];
        var visible = message['visible'];
        var name = message['name'];
        /* TODO translate color to CSS value */
        var prefix_color = message['prefix_color'];
        /* TODO translate color to CSS value */
        var color = message['color'];

        return {
            prefix: prefix,
            visible: visible,
            name: name,
            prefix_color: prefix_color,
            color: color
        }
    }
    /*
     * Nicklist Group class
     */
    this.NickGroup = function(message) {
        var name = message['name'];
        var visible = message['visible'];
        var nicks = [];

        return {
            name: name,
            visible: visible,
            nicks: nicks
        }
    }
          

    var BufferList = []
    activeBuffer = null;
    unreads = 0;
    notifications = 0;
    
    this.model = { 'buffers': {} }

    /*
     * Adds a buffer to the list
     *
     * @param buffer buffer object
     * @return undefined
     */
    this.addBuffer = function(buffer) {
        BufferList[buffer.id] = buffer;
        if (BufferList.length == 1) {
            activeBuffer = buffer.id;
        }
        this.model.buffers[buffer.id] = buffer;
    }

    this.getBufferByIndex  = function(index) {
        var i = 0;

        for (var v in BufferList) {
            if (index == ++i) {
                return BufferList[v];
            }
        }

    }

    /*
     * Returns the current active buffer
     *
     * @return active buffer object
     */
    this.getActiveBuffer = function() {
        return activeBuffer;
    }

    /*
     * Sets the buffer specifiee by bufferId as active.
     * Deactivates the previous current buffer.
     *
     * @param bufferId id of the new active buffer
     * @return undefined
     */
    this.setActiveBuffer = function(bufferId) {

        var previousBuffer = this.getActiveBuffer();
        
        if (previousBuffer) {
            // turn off the active status for the previous buffer
            previousBuffer.active = false;
            // Save the last line we saw
            previousBuffer.lastSeen = previousBuffer.lines.length-1;
        }

        activeBuffer = _.find(this.model['buffers'], function(buffer) {
            if (buffer['id'] == bufferId) {
                return buffer;
            }
        });

        activeBuffer.active = true;
        activeBuffer.unread = 0;
        activeBuffer.notification = 0;

        $rootScope.$emit('activeBufferChanged');
        $rootScope.$emit('notificationChanged');
    }

    /*
     * Returns the buffer list
     */
    this.getBuffers = function() {
        return BufferList;
    }

    /*
     * Returns a specific buffer object
     *
     * @param bufferId id of the buffer
     * @return the buffer object
     */
    this.getBuffer = function(bufferId) {
        return _.find(this.model['buffers'], function(buffer) {
            if (buffer['id'] == bufferId) {
                return buffer;
            }
        });
    }

    /*
     * Closes a weechat buffer. Sets the first buffer
     * as active.
     *
     * @param bufferId id of the buffer to close
     * @return undefined
     */
    this.closeBuffer = function(bufferId) {

        delete(this.model['buffers'][bufferId.id]);
        var firstBuffer = _.keys(this.model['buffers'])[0];
        this.setActiveBuffer(firstBuffer);
    }
}]);
