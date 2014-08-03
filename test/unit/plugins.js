/* plugins go here */

var msg = function(msg) {
    return {'text': msg }
}

var metadata_name = function(message) {
    return message['metadata'][0]['name']
}

var expectTheseMessagesToContain = function(urls, pluginType, plugins) {
    for (var i = 0; i < urls.length; i++) {
        expect(
            metadata_name(
                plugins.PluginManager.contentForMessage(msg(urls[i]))
            )
        ).toEqual(pluginType);
    }
}

describe('filter', function() {
    beforeEach(module('plugins'));

    describe('Plugins', function() {
        beforeEach(module(function($provide) {
            $provide.value('version', 'TEST_VER');
        }));

        it('should recognize spotify tracks', inject(function(plugins) {
            expectTheseMessagesToContain([
                'https://spotify:track:3AAAAAAAAAAAAAAAAAAAAA',
                'https://open.spotify.com/track/3AAAAAAAAAAAAAAAAAAAAA'
            ],
            'Spotify track',
            plugins);
        }));


        it('should recognize youtube videos', inject(function(plugins) {
            expectTheseMessagesToContain([
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'http://youtu.be/J6vIS8jb6Fs',
                'https://youtu.be/J6vIS8jb6Fs',
                'http://www.youtube.com/embed?v=dQw4w9WgXcQ',
                'https://www.youtube.com/embed?v=dQw4w9WgXcQ'
            ],
            'YouTube video',
            plugins);
        }));

        it('should recognize dailymotion videos', inject(function(plugins) {
            expectTheseMessagesToContain([
                'dailymotion.com/video/test',
                'dailymotion.com/video/#video=asdf',
                'dai.ly/sfg'
            ],
            'Dailymotion video',
            plugins);
        }));

        it('should recognize allocine videos', inject(function(plugins) {
            expectTheseMessagesToContain([
                'allocine.fr/videokast/video-12',
                'allocine.fr/cmedia=234'
            ],
            'AlloCine video',
            plugins);
        }));

        it('should recognize images', inject(function(plugins) {
            expectTheseMessagesToContain([
                'http://test.png',
                'https://test.jpg',
                'https://test.jpeg',
                'https://test.gif',
            ],
            'image',
            plugins);
        }));

        it('should recognize cloud music', inject(function(plugins) {
            expectTheseMessagesToContain([
                'http://soundcloud.com/',
                'https://sadf.mixcloud.com/',
            ],
            'cloud music',
            plugins);
        }));

        it('should recognize google map', inject(function(plugins) {
            expectTheseMessagesToContain([
                'https://www.google.com/maps/@48.0034139,-74.9129088,6z',
            ],
            'Google Map',
            plugins);
        }));

        it('should recognize google map', inject(function(plugins) {
            expectTheseMessagesToContain([
                'https://asciinema.org/a/10625',
            ],
            'ascii cast',
            plugins);
        }));

        it('should recognize meteograms', inject(function(plugins) {
            expectTheseMessagesToContain([
                'http://www.yr.no/sted/Canada/Quebec/Montreal/',
            ],
            'meteogram',
            plugins);
        }));

    });
});
