/*
 * This file contains the weechat models and various
 * helper methods to work with them.
 */
var models = angular.module('weechatModels', []);

models.service('models', ['colors', function(colors) {
    /*
     * Buffer class
     */
    this.Buffer = function(message) {
        // weechat properties
        var fullName = message['full_name']
        var pointer = message['pointers'][0]
        var lines = []
        var active = false;
        var notification = false;

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
            lines: lines,
            addLine: addLine
        }

    }
    
    /*
     * BufferLine class
     */
    this.BufferLine = function(weechatBufferLine) {

        /*
         * Parse the text elements from the buffer line added
         *
         * @param message weechat message
         */
        function parseLineAddedTextElements(message) {
            var prefix = colors.parse(message['objects'][0]['content'][0]['prefix']);

            var buffer = message['objects'][0]['content'][0]['buffer'];
            text_elements = _.union(prefix, text);
            text_elements =_.map(text_elements, function(text_element) {
                if (text_element && ('fg' in text_element)) {
                    text_element['fg'] = colors.prepareCss(text_element['fg']);
                }
                // TODO: parse background as well

                return text_element;
            });
            return text_elements;
        }


        var buffer = message['objects'][0]['content'][0]['buffer'];
        var date = message['objects'][0]['content'][0]['date'];
        var text = colors.parse(message['objects'][0]['content'][0]['message']);
        var content = parseLineAddedTextElements(message);

        return {
            content: content,
            date: date,
            buffer: buffer,
            text: text[0]['text'],
        }

    }    


    var BufferList = []
    activeBuffer = null;
    
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
        
        if (this.getActiveBuffer()) {
            this.getActiveBuffer().active = false;
        }

        activeBuffer = _.find(this.model['buffers'], function(buffer) {
            if (buffer['id'] == bufferId) {
                return buffer;
            }
        });
        activeBuffer.notification = false;
        activeBuffer.active = true;

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
