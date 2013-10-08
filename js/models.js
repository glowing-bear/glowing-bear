var models = angular.module('weechatModels', []);

models.factory('models', ['colors', function(colors) {

    function Buffer(message) {

        var fullName = message['full_name']
        var pointer = message['pointers'][0]
        var lines = []
        
        return {
            id: pointer,
            fullName: fullName,
            lines: lines,
        }

    }

    function BufferLine(weechatBufferLine) {

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

    return {
        BufferLine: BufferLine,
        Buffer: Buffer
    }

    
}]);
