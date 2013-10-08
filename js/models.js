var models = angular.module('weechatModels', []);

models.service('models', ['colors', function(colors) {

    var BufferList = []
    activeBuffer = null;
    
    this.model = { 'buffers': {} }

    this.addBuffer = function(buffer) {
        BufferList[buffer.id] = buffer;
        if (BufferList.length == 1) {
            activeBuffer = buffer.id;
        }
        this.model.buffers[buffer.id] = buffer;
    }

    this.getActiveBuffer = function() {
        return activeBuffer;
    }

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

    this.getBuffers = function() {
        return BufferList;
    }

    this.getBuffer = function(bufferId) {
        return _.find(this.model['buffers'], function(buffer) {
            if (buffer['id'] == bufferId) {
                return buffer;
            }
        });
    }

    this.closeBuffer = function(bufferId) {

        delete(this.model['buffers'][bufferId.id]);
        var firstBuffer = _.keys(this.model['buffers'])[0];
        this.setActiveBuffer(firstBuffer);
    }

    this.Buffer = function(message) {

        var fullName = message['full_name']
        var pointer = message['pointers'][0]
        var lines = []
        var active = false;
        var notification = false;

        var notify = function() {
            notification = true;
        }

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

    this.BufferLine = function(weechatBufferLine) {

        /*
         * Parse the text elements from the buffer line added
         *
         */
        function parseLineAddedTextElements(message) {
            var prefix = colors.parse(message['objects'][0]['content'][0]['prefix']);

            var buffer = message['objects'][0]['content'][0]['buffer'];
            text_elements = _.union(prefix, text);
            text_elements =_.map(text_elements, function(text_element) {
                if ('fg' in text_element) {
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

    this.getBufferList = function() {
        return BufferList;
    }
    
}]);
