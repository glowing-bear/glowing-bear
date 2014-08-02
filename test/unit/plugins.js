/* plugins go here */

var msg = function(msg) {
    return {'text': msg }
}

var metadata_name = function(message) {
    return message['metadata'][0]['name']
}

describe('filter', function() {
    beforeEach(module('plugins'));


    describe('Plugins', function() {
        beforeEach(module(function($provide) {
            $provide.value('version', 'TEST_VER');
        }));


        it('should recognize youtube videos', inject(function(plugins) {
            expect(
                metadata_name(
                    plugins.PluginManager.contentForMessage(msg('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
                )
            ).toEqual('YouTube video');
        }));
    });
});
