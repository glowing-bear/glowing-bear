/*
 * This file contains the plugin definitions
 */

(function() {
'use strict';

var plugins = angular.module('plugins', []);

/*
 * Definition of a user provided plugin with sensible default values
 *
 * User plugins are created by providing a name and a contentForMessage
 * function that parses a string and returns any additional content.
 */
var Plugin = function(name, contentForMessage) {
    return {
        contentForMessage: contentForMessage,
        exclusive: false,
        name: name
    };
};


// Regular expression that detects URLs for UrlPlugin
var urlRegexp = /(?:ftp|https?):\/\/\S*[^\s.;,(){}<>]/g;
/*
 * Definition of a user provided plugin that consumes URLs
 *
 * URL plugins are created by providing a name and a function that
 * that parses a URL and returns any additional content.
 */
var UrlPlugin = function(name, urlCallback) {
    return {
        contentForMessage: function(message) {
            var urls = message.match(urlRegexp);
            var content = [];

            for (var i = 0; urls && i < urls.length; i++) {
                var result = urlCallback(urls[i]);
                if (result) {
                    content.push(result);
                }
            }
            return content;
        },
        exclusive: false,
        name: name
    };
};

/*
 * This service provides access to the plugin manager
 *
 * The plugin manager is where the various user provided plugins
 * are registered. It is responsible for finding additional content
 * to display when messages are received.
 *
 */
plugins.service('plugins', ['userPlugins', '$sce', function(userPlugins, $sce) {

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
            }
        };

        var nsfwRegexp = new RegExp('nsfw', 'i');

        /*
         * Iterates through all the registered plugins
         * and run their contentForMessage function.
         */
        var contentForMessage = function(message) {
            message.metadata = [];

            var addPluginContent = function(content, pluginName, num) {
                if (num) {
                    pluginName += " " + num;
                }

                // If content isn't a callback, it's HTML
                if (!(content instanceof Function)) {
                    content = $sce.trustAsHtml(content);
                }

                message.metadata.push({
                    'content': content,
                    'nsfw': nsfw,
                    'name': pluginName
                });
            };

            for (var i = 0; i < plugins.length; i++) {

                var nsfw = false;
                if (message.text.match(nsfwRegexp)) {
                    nsfw = true;
                }

                var pluginContent = plugins[i].contentForMessage(message.text);
                if (pluginContent && pluginContent !== []) {

                    if (pluginContent instanceof Array) {
                        for (var j = pluginContent.length - 1; j >= 0; j--) {
                            // only give a number if there are multiple embeds
                            var num = (pluginContent.length == 1) ? undefined : (j + 1);
                            addPluginContent(pluginContent[j], plugins[i].name, num);
                        }
                    } else {
                        addPluginContent(pluginContent, plugins[i].name);
                    }

                    if (plugins[i].exclusive) {
                        break;
                    }
                }
            }

            return message;
        };

        return {
            registerPlugins: registerPlugins,
            contentForMessage: contentForMessage
        };
    };

    // Instanciates and registers the plugin manager.
    this.PluginManager = new PluginManagerObject();
    this.PluginManager.registerPlugins(userPlugins.plugins);

}]);

/*
 * This factory exposes the collection of user provided plugins.
 *
 * To create your own plugin, you need to:
 *
 * 1. Define its contentForMessage function. The contentForMessage
 *    function takes a string as a parameter and returns a HTML string.
 *
 * 2. Instantiate a Plugin object with contentForMessage function as its
 *    argument.
 *
 * 3. Add it to the plugins array.
 *
 */
plugins.factory('userPlugins', function() {
    // standard JSONp origin policy trick
    var jsonp = function (url, callback) {
        var callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            callback(data);
        };

        var script = document.createElement('script');
        script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
        document.body.appendChild(script);
    };

    /*
     * Spotify Embedded Player
     *
     * See: https://developer.spotify.com/technologies/widgets/spotify-play-button/
     *
     */

    var spotifyPlugin = new Plugin('Spotify track', function(message) {
        var content = [];
        var addMatch = function(match) {
            for (var i = 0; match && i < match.length; i++) {
                var id = match[i].substr(match[i].length - 22, match[i].length);
                content.push('<iframe src="//embed.spotify.com/?uri=spotify:track:' + id + '" width="300" height="80" frameborder="0" allowtransparency="true"></iframe>');
            }
        };
        addMatch(message.match(/spotify:track:([a-zA-Z-0-9]{22})/g));
        addMatch(message.match(/open.spotify.com\/track\/([a-zA-Z-0-9]{22})/g));
        return content;
    });

    /*
     * YouTube Embedded Player
     *
     * See: https://developers.google.com/youtube/player_parameters
     */
    var youtubePlugin = new UrlPlugin('YouTube video', function(url) {
        var regex = /(?:youtube.com|youtu.be)\/(?:v\/|embed\/|watch(?:\?v=|\/))?([a-zA-Z0-9-]+)/i,
            match = url.match(regex);

        if (match){
            var token = match[1],
                embedurl = "https://www.youtube.com/embed/" + token + "?html5=1&iv_load_policy=3&modestbranding=1&rel=0&showinfo=0";
            return '<iframe width="560" height="315" src="'+ embedurl + '" frameborder="0" allowfullscreen frameborder="0"></iframe>';
        }
    });

    /*
     * Dailymotion Embedded Player
     *
     * See: http://www.dailymotion.com/doc/api/player.html
     */
    var dailymotionPlugin = new Plugin('Dailymotion video', function(message) {
        var rPath = /dailymotion.com\/.*video\/([^_?# ]+)/;
        var rAnchor = /dailymotion.com\/.*#video=([^_& ]+)/;
        var rShorten = /dai.ly\/([^_?# ]+)/;

        var match = message.match(rPath) || message.match(rAnchor) || message.match(rShorten);
        if (match) {
            var id = match[1];
            var embedurl = 'https://www.dailymotion.com/embed/video/' + id + '?html&controls=html&startscreen=html&info=0&logo=0&related=0';
            return '<iframe frameborder="0" width="480" height="270" src="' + embedurl + '"></iframe>';
        }

        return null;
    });

    /*
     * AlloCine Embedded Player
     */
    var allocinePlugin = new Plugin('AlloCine video', function(message) {
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

    /*
     * Image Preview
     */
    var imagePlugin = new UrlPlugin('image', function(url) {
        if (url.match(/\.(png|gif|jpg|jpeg)(:(small|medium|large))?\b/i)) {
            /* A fukung.net URL may end by an image extension but is not a direct link. */
            if (url.indexOf("^https?://fukung.net/v/") != -1) {
                url = url.replace(/.*\//, "http://media.fukung.net/imgs/");
            } else if (url.match(/^http:\/\/(i\.)?imgur\.com\//i)) {
                // remove protocol specification to load over https if used by g-b
                url = url.replace(/http:/, "");
            } else if (url.match(/^https:\/\/www\.dropbox\.com\/s\/[a-z0-9]+\/[^?]+$/i)) {
                // Dropbox requires a get parameter, dl=1
                // TODO strip an existing dl=0 parameter
                url = url + "?dl=1";
            }

            return '<a target="_blank" href="'+url+'"><img class="embed" src="' + url + '"></a>';
        }
    });

    /*
     * mp4 video Preview
     */
    var videoPlugin = new UrlPlugin('video', function(url) {
        if (url.match(/\.(mp4|webm|ogv)\b/i)) {
            return '<video class="embed" width="560"><source src="'+url+'"></source></video>';
        }
    });

    /*
     * Cloud Music Embedded Players
     */
    var cloudmusicPlugin = new UrlPlugin('cloud music', function(url) {
        /* SoundCloud http://help.soundcloud.com/customer/portal/articles/247785-what-widgets-can-i-use-from-soundcloud- */
        if (url.match(/^https?:\/\/soundcloud.com\//)) {
            return '<iframe width="100%" height="120" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url=' + url + '&amp;color=ff6600&amp;auto_play=false&amp;show_artwork=true"></iframe>';
        }

        /* MixCloud */
        if (url.match(/^https?:\/\/([a-z]+\.)?mixcloud.com\//)) {
            return '<iframe width="480" height="60" src="//www.mixcloud.com/widget/iframe/?feed=' + url + '&mini=1&stylecolor=&hide_artwork=&embed_type=widget_standard&hide_tracklist=1&hide_cover=" frameborder="0"></iframe>';
        }
    });

    /*
     * Google Maps
     */
    var googlemapPlugin = new UrlPlugin('Google Map', function(url) {
        if (url.match(/^https?:\/\/maps\.google\./i) || url.match(/^https?:\/\/(?:[\w]+\.)?google\.[\w]+\/maps/i)) {
            return '<iframe width="450" height="350" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="' + url + '&output=embed"></iframe>';
        }
    });

    /*
      * Asciinema plugin
     */
    var asciinemaPlugin = new UrlPlugin('ascii cast', function(url) {
        var regexp = /^https?:\/\/(?:www\.)?asciinema.org\/a\/(\d+)/i,
            match = url.match(regexp);
        if (match) {
            var id = match[1];
            return function() {
                var element = this.getElement();
                var scriptElem = document.createElement('script');
                scriptElem.src = 'https://asciinema.org/a/' + id + '.js';
                scriptElem.id = 'asciicast-' + id;
                scriptElem.async = true;
                element.appendChild(scriptElem);
            };
        }
    });

    var yrPlugin = new UrlPlugin('meteogram', function(url) {
        var regexp = /^https?:\/\/(?:www\.)?yr\.no\/(place|stad|sted|sadji|paikka)\/(([^\s.;,(){}<>\/]+\/){3,})/;
        var match = url.match(regexp);
        if (match) {
            var language = match[1];
            var location = match[2];
            var city = match[match.length - 1].slice(0, -1);
            url = "http://www.yr.no/" + language + "/" + location + "avansert_meteogram.png";
            return "<img src='" + url + "' alt='Meteogram for " + city + "' />";
        }
    });

    // Embed GitHub gists
    var gistPlugin = new UrlPlugin('Gist', function(url) {
        var regexp = /^https:\/\/gist\.github.com\/[^.?]+/i;
        var match = url.match(regexp);
        if (match) {
            // get the URL from the match to trim away pseudo file endings and request parameters
            url = match[0] + '.json';
            // load gist asynchronously -- return a function here
            return function() {
                var element = this.getElement();
                jsonp(url, function(data) {
                    // Add the gist stylesheet only once
                    if (document.querySelectorAll('link[rel=stylesheet][href="' + data.stylesheet + '"]').length < 1) {
                        var stylesheet = '<link rel="stylesheet" href="' + data.stylesheet + '"></link>';
                        document.getElementsByTagName('head')[0].innerHTML += stylesheet;
                    }
                    element.innerHTML = '<div style="clear:both">' + data.div + '</div>';
                });
            };
        }
    });

    var tweetPlugin = new UrlPlugin('Tweet', function(url) {
        var regexp = /^https?:\/\/twitter\.com\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i;
        var match = url.match(regexp);
        if (match) {
            url = 'https://api.twitter.com/1/statuses/oembed.json?id=' + match[2];
            return function() {
                var element = this.getElement();
                jsonp(url, function(data) {
                    // separate the HTML into content and script tag
                    var scriptIndex = data.html.indexOf("<script ");
                    var content = data.html.substr(0, scriptIndex);
                    // Set DNT (Do Not Track)
                    content = content.replace("<blockquote class=\"twitter-tweet\">", "<blockquote class=\"twitter-tweet\" data-dnt=\"true\">");
                    element.innerHTML = content;

                    // The script tag needs to be generated manually or the browser won't load it
                    var scriptElem = document.createElement('script');
                    // Hardcoding the URL here, I don't suppose it's going to change anytime soon
                    scriptElem.src = "//platform.twitter.com/widgets.js";
                    element.appendChild(scriptElem);
                });
            };
        }
    });

    /*
     * Vine plugin
     */
    var vinePlugin = new UrlPlugin('Vine', function (url) {
        var regexp = /^https?:\/\/(www\.)?vine.co\/v\/([a-zA-Z0-9]+)(\/.*)?/i,
            match = url.match(regexp);
        if (match) {
            var id = match[2], embedurl = "https://vine.co/v/" + id + "/embed/simple?audio=1";
            return '<iframe class="vine-embed" src="' + embedurl + '" width="600" height="600" frameborder="0"></iframe><script async src="//platform.vine.co/static/scripts/embed.js" charset="utf-8"></script>';
        }
    });

    return {
        plugins: [youtubePlugin, dailymotionPlugin, allocinePlugin, imagePlugin, videoPlugin, spotifyPlugin, cloudmusicPlugin, googlemapPlugin, asciinemaPlugin, yrPlugin, gistPlugin, tweetPlugin, vinePlugin]
    };


});
})();
