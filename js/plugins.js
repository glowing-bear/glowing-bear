/*
 * This file contains the plugin definitions
 */

plugins = angular.module('plugins', []);

/*
 * Definition of a user provided plugin with sensible default values
 *
 * User plugins are created by providing a contentForMessage function
 * that parses a string and return any additional content.
 */
var Plugin = function(contentForMessage) {
    
    return {
        contentForMessage: contentForMessage,
        exclusive: false,
        name: "additional content"
    }
}

/*
 * This service provides access to the plugin manager
 *
 * The plugin manager is where the various user provided plugins
 * are registered. It is responsible for finding additional content
 * to display when messages are received.
 *
 */
plugins.service('plugins', ['userPlugins', '$sce', function(userPlugins, $sce) {

    var nsfwRegexp = new RegExp('nsfw', 'i');

    /*
     * Defines the plugin manager object
     */
    var PluginManagerObject = function() {
        
        var plugins = [];

        /*
         * Register the user provides plugins
         *
         * @param userPlugins user provided plugins
         */
        var registerPlugins = function(userPlugins) {
            for (var i = 0; i < userPlugins.length; i++) {
                plugins.push(userPlugins[i]);
            };
        }

        /*
         * Iterates through all the registered plugins
         * and run their contentForMessage function.
         */
        var contentForMessage = function(message, visible) {

            message.metadata = [];
            for (var i = 0; i < plugins.length; i++) {

                var nsfw = false;
                if (message.text.match(nsfwRegexp)) {
                    var nsfw = true;
                    visible = false;
                }

                var pluginContent = plugins[i].contentForMessage(message.text);
                if (pluginContent) {
                    var pluginContent = {'visible': visible,
                                         'content': $sce.trustAsHtml(pluginContent),
                                         'nsfw': nsfw,
                                         'name': plugins[i].name }

                    message.metadata.push(pluginContent);


                    if (plugins[i].exclusive) {
                        break;
                    }
                }
            }

            /* Replace all URLs with hyperlinks  */

            var urlRegexp = RegExp(/(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/g);
            for(k in message.content) {
                var text = message.content[k].text;
                var url = text.match(urlRegexp);
                for(i in url) {
                    var u = url[i];
                    text = text.replace(u, '<a target="_blank" href="' + u + '">' + u + '</a>');
                }
                message.content[k].text = $sce.trustAsHtml(text);
            }

            return message;
        }

        return {
            registerPlugins: registerPlugins,
            contentForMessage: contentForMessage
        }
    }

    // Instanciates and registers the plugin manager.
    this.PluginManager = new PluginManagerObject();
    this.PluginManager.registerPlugins(userPlugins.plugins);

}]);

/*
 * This factory exposes the collection of user provided plugins.
 *
 * To create your own plugin, you need to:
 *
 * 1. Define it's contentForMessage function. The contentForMessage
 *    function takes a string as a parameter and returns a HTML string.
 *
 * 2. Instanciate a Plugin object with contentForMessage function as it's
 *    argument.
 *
 * 3. Add it to the plugins array.
 *
 */
plugins.factory('userPlugins', function() {

    var urlRegexp = RegExp(/(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/);

    /*
     * Spotify Embedded Player
     *
     * See: https://developer.spotify.com/technologies/widgets/spotify-play-button/
     *
     */

    var spotifyPlugin = new Plugin(function(message) {
        var addMatch = function(match) {
            var ret = '';
            for(i in match) {
                var id = match[i].substr(match[i].length-22, match[i].length);
                ret += '<iframe src="//embed.spotify.com/?uri=spotify:track:'+id+'" width="300" height="80" frameborder="0" allowtransparency="true"></iframe>';
            }
            return ret;
        };
        var match = message.match(/spotify:track:([a-zA-Z-0-9]{22})/g);
        var ret = addMatch(match);
        ret += addMatch(message.match(/open.spotify.com\/track\/([a-zA-Z-0-9]{22})/g));
        return ret;
    });
    spotifyPlugin.name = 'Spotify track'

    /*
     * YouTube Embedded Player
     *
     * See: https://developers.google.com/youtube/player_parameters
     */
    var youtubePlugin = new Plugin(function(message) {

        var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
        var match = message.match(regExp);
        if (match && match[7].length==11){
            var token = match[7];
            var embedurl = "http://www.youtube.com/embed/" + token + "?html5=1&iv_load_policy=3&modestbranding=1&rel=0&showinfo=0";
            return '<iframe width="560" height="315" src="'+ embedurl + '" frameborder="0" allowfullscreen frameborder="0"></iframe>';
        }

        return null;
    });
    youtubePlugin.name = 'YouTube video';

    /*
     * Dailymotion Embedded Player
     *
     * See: http://www.dailymotion.com/doc/api/player.html
     */
    var dailymotionPlugin = new Plugin(function(message) {

        var rPath = /dailymotion.com\/.*video\/([^_?# ]+)/;
        var rAnchor = /dailymotion.com\/.*#video=([^_& ]+)/;
        var rShorten = /dai.ly\/([^_?# ]+)/;

        var match = message.match(rPath) || message.match(rAnchor) || message.match(rShorten);
        if (match) {
            var id = match[1];
            var embedurl = 'http://www.dailymotion.com/embed/video/' + id + '?html&controls=html&startscreen=html&info=0&logo=0&related=0';
            return '<iframe frameborder="0" width="480" height="270" src="' + embedurl + '"></iframe>';
        }

        return null;
    });
    dailymotionPlugin.name = 'Dailymotion video';

    /*
     * AlloCine Embedded Player
     */
    var allocinePlugin = new Plugin(function(message) {

        var rVideokast = /allocine.fr\/videokast\/video-(\d+)/;
        var rCmedia = /allocine.fr\/.*cmedia=(\d+)/;

        var match = message.match(rVideokast) || message.match(rCmedia);
        if (match) {
            var id = match[1];
            var embedurl = 'http://www.allocine.fr/_video/iblogvision.aspx?cmedia=' + id;
            return '<iframe frameborder="0" width="480" height="270" src="' + embedurl + '"></iframe>';
        }

        return null;
    });
    allocinePlugin.name = 'AlloCine video';

    /*
     * Image Preview
     */
    var imagePlugin = new Plugin(function(message) {

        var url = message.match(urlRegexp);
        var content = null;

        if (url) {
            var url = url[0]; /* Actually parse one url per message */
            if (url.match(/png$|gif$|jpg$|jpeg$/)) {

                /* A fukung.net URL may end by an image extension but is not a direct link. */
                if (url.indexOf("fukung.net/v/") != -1) {
                    url = url.replace(/.*\//, "http://media.fukung.net/imgs/")
                }

                content = '<a target="_blank" href="'+url+'"><img class="embed" src="' + url + '"></a>';
            }
        }

        return content;
    });
    imagePlugin.name = 'image';

    /*
     * Cloud Music Embedded Players
     */
    var cloudmusicPlugin = new Plugin(function(message) {

        var match = message.match(urlRegexp);

        if (match) {
            var url = match[0];

            /* SoundCloud http://help.soundcloud.com/customer/portal/articles/247785-what-widgets-can-i-use-from-soundcloud- */
            if (url.indexOf("soundcloud.com") != -1) {
                return '<iframe width="100%" height="120" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url=' + url + '&amp;color=ff6600&amp;auto_play=false&amp;show_artwork=true"></iframe>';
            }

            /* MixCloud */
            if (url.indexOf("mixcloud.com") != -1) {
                return '<iframe width="480" height="60" src="//www.mixcloud.com/widget/iframe/?feed=' + url + '&mini=1&stylecolor=&hide_artwork=&embed_type=widget_standard&hide_tracklist=1&hide_cover=" frameborder="0"></iframe>';
            }
        }

        return null;
    });
    cloudmusicPlugin.name = 'cloud music';

    /*
     * Google Maps
     */
    var googlemapPlugin = new Plugin(function(message) {

        var match = message.match(urlRegexp);

        if (match) {
            var url = match[0];

            /* SoundCloud http://help.soundcloud.com/customer/portal/articles/247785-what-widgets-can-i-use-from-soundcloud- */
            if (url.match(/google.*maps/)) {
                return '<iframe width="450" height="350" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="' + url + '&output=embed"></iframe>';
            }
        }

        return null;
    });
    googlemapPlugin.name = 'Google Map';

    return {
        plugins: [youtubePlugin, dailymotionPlugin, allocinePlugin, imagePlugin, spotifyPlugin, cloudmusicPlugin, googlemapPlugin]
    }
});
