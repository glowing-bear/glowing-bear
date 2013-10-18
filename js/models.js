/*
 * This file contains the weechat models and various
 * helper methods to work with them.
 */
var models = angular.module('weechatModels', []);

models.service('models', ['$rootScope', 'colors', function($rootScope, colors) {
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
        var notify = 1; // Default 1
        var lines = []
        var active = false
        var notification = 0 
        var unread = 0
        var lastSeen = -2

        // Buffer opened message does not include notify level
        if( message['notify'] ) {
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
        }

    }
    
    /*
     * BufferLine class
     */
    this.BufferLine = function(message) {

        /*
         * Parse the text elements from the buffer line added
         *
         * @param message weechat message
         */
        function parseLineAddedTextElements(message) {
            var text = colors.parse(message);
            text_elements =_.map(text, function(text_element) {
                if (text_element && ('fg' in text_element)) {
                    text_element['fg'] = colors.prepareCss(text_element['fg']);
                }
                // TODO: parse background as well

                return text_element;
            });
            return text_elements;
        }


        var buffer = message['buffer'];
        var date = message['date'];


        var prefix = parseLineAddedTextElements(message['prefix']);

        var tags_array = message['tags_array'];
        var displayed = message['displayed'];
        var highlight = message['highlight'];
        var content = parseLineAddedTextElements(message['message']);

        var rtext = "";
        if(content[0] != undefined) {
            rtext = content[0]['text'];
        }

       return {
            prefix: prefix,
            content: content,
            date: date,
            buffer: buffer,
            tags: tags_array,
            highlight: highlight,
            displayed: displayed,
            text: rtext,
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
