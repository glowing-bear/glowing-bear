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
var urlRegexp = /(?:(?:https?|ftp):\/\/|www\.|ftp\.)\S*[^\s.;,(){}<>]/g;
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

                var pluginContent = plugins[i].contentForMessage(
                    message.text
                );
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
                var element = angular.element('<iframe></iframe>')
                                     .attr('src', '//embed.spotify.com/?uri=spotify:track:' + id)
                                     .attr('width', '300')
                                     .attr('height', '80')
                                     .attr('frameborder', '0')
                                     .attr('allowtransparency', 'true');
                content.push(element.prop('outerHTML'));
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
                embedurl = "https://www.youtube.com/embed/" + token + "?html5=1&iv_load_policy=3&modestbranding=1&rel=0&showinfo=0",
                element = angular.element('<iframe></iframe>')
                                 .attr('src', embedurl)
                                 .attr('width', '560')
                                 .attr('height', '315')
                                 .attr('frameborder', '0')
                                 .attr('allowfullscreen', 'true');
            return element.prop('outerHTML');
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
            var element = angular.element('<iframe></iframe>')
                                 .attr('src', embedurl)
                                 .attr('width', '480')
                                 .attr('height', '270')
                                 .attr('frameborder', '0');
            return element.prop('outerHTML');
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
            var element = angular.element('<iframe></iframe>')
                                 .attr('src', embedurl)
                                 .attr('width', '480')
                                 .attr('height', '270')
                                 .attr('frameborder', '0');
            return element.prop('outerHTML');
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
                // always load imgur over https
                url = url.replace(/http:/, "https://");
            } else if (url.match(/^https:\/\/www\.dropbox\.com\/s\/[a-z0-9]+\//i)) {
                // Dropbox requires a get parameter, dl=1
                var dbox_url = document.createElement("a");
                dbox_url.href = url;
                var base_url = dbox_url.protocol + '//' + dbox_url.host + dbox_url.pathname + '?';
                var dbox_params = dbox_url.search.substring(1).split('&');
                var dl_added = false;
                for (var i = 0; i < dbox_params.length; i++) {
                    if (dbox_params[i].split('=')[0] === "dl") {
                        dbox_params[i] = "dl=1";
                        dl_added = true;
                        // we continue looking at the other parameters in case
                        // it's specified twice or something
                    }
                }
                if (!dl_added) {
                    dbox_params.push("dl=1");
                }
                url = base_url + dbox_params.join('&');
            }
            return function() {
                var element = this.getElement();
                var imgElem = angular.element('<a></a>')
                                     .attr('target', '_blank')
                                     .attr('href', url)
                                     .append(angular.element('<img>')
                                                    .addClass('embed')
                                                    .attr('src', url));
                element.innerHTML = imgElem.prop('outerHTML');
            };
        }
    });

    /*
     * audio Preview
     */
    var audioPlugin = new UrlPlugin('audio', function(url) {
        if (url.match(/\.(mp3|ogg|wav)\b/i)) {
            return function() {
                var element = this.getElement();
                var aelement = angular.element('<audio controls></audio>')
                                     .addClass('embed')
                                     .attr('width', '560')
                                     .append(angular.element('<source></source>')
                                                    .attr('src', url));
                element.innerHTML = aelement.prop('outerHTML');
            };
        }
    });


    /*
     * mp4 video Preview
     */
    var videoPlugin = new UrlPlugin('video', function(url) {
        if (url.match(/\.(mp4|webm|ogv|gifv)\b/i)) {
            if (url.match(/^http:\/\/(i\.)?imgur\.com\//i)) {
                // remove protocol specification to load over https if used by g-b
                url = url.replace(/\.(gifv)\b/i, ".webm");
            }
            return function() {
                var element = this.getElement();
                var velement = angular.element('<video autoplay loop muted></video>')
                                     .addClass('embed')
                                     .attr('width', '560')
                                     .append(angular.element('<source></source>')
                                                    .attr('src', url));
                element.innerHTML = velement.prop('outerHTML');
            };
        }
    });


    /*
     * Cloud Music Embedded Players
     */
    var cloudmusicPlugin = new UrlPlugin('cloud music', function(url) {
        /* SoundCloud http://help.soundcloud.com/customer/portal/articles/247785-what-widgets-can-i-use-from-soundcloud- */
        var element;
        if (url.match(/^https?:\/\/soundcloud.com\//)) {
            element = angular.element('<iframe></iframe>')
                             .attr('width', '100%')
                             .attr('height', '120')
                             .attr('scrolling', 'no')
                             .attr('frameborder', 'no')
                             .attr('src', 'https://w.soundcloud.com/player/?url=' + url + '&amp;color=ff6600&amp;auto_play=false&amp;show_artwork=true');
            return element.prop('outerHTML');
        }

        /* MixCloud */
        if (url.match(/^https?:\/\/([a-z]+\.)?mixcloud.com\//)) {
            element = angular.element('<iframe></iframe>')
                             .attr('width', '480')
                             .attr('height', '60')
                             .attr('frameborder', '0')
                             .attr('src', '//www.mixcloud.com/widget/iframe/?feed=' + url + '&mini=1&stylecolor=&hide_artwork=&embed_type=widget_standard&hide_tracklist=1&hide_cover=');
            return element.prop('outerHTML');
        }
    });

    /*
     * Google Maps
     */
    var googlemapPlugin = new UrlPlugin('Google Map', function(url) {
        if (url.match(/^https?:\/\/maps\.google\./i) || url.match(/^https?:\/\/(?:[\w]+\.)?google\.[\w]+\/maps/i)) {
            var element = angular.element('<iframe></iframe>')
                                 .attr('width', '450')
                                 .attr('height', '350')
                                 .attr('frameborder', '0')
                                 .attr('scrolling', 'no')
                                 .attr('marginheight', '0')
                                 .attr('src', url + '&output=embed');
            return element.prop('outerHTML');
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
            return function() {
                var element = this.getElement();
                var language = match[1];
                var location = match[2];
                var city = match[match.length - 1].slice(0, -1);
                url = "http://www.yr.no/" + language + "/" + location + "avansert_meteogram.png";
                var ielement = angular.element('<img>')
                                     .attr('src', url)
                                     .attr('alt', 'Meteogram for ' + city);
                element.innerHTML = ielement.prop('outerHTML');
            };
        }
    });

/*
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
*/

 /* match giphy links and display the assocaited gif images
  * sample input:  http://giphy.com/gifs/eyes-shocked-bird-feqkVgjJpYtjy
  * sample output: https://media.giphy.com/media/feqkVgjJpYtjy/giphy.gif
  */
    var giphyPlugin = new UrlPlugin('Giphy', function(url) {
        var regex = /^https?:\/\/giphy.com\/gifs\/.*-(.*)\/?/i;
        // on match, id will contain the entire url in [0] and the giphy id in [1]
        var id = url.match(regex);
        if (id) {
            var src = "https://media.giphy.com/media/" + id[1] + "/giphy.gif";
            return function() {
                var element = this.getElement();
                var gelement = angular.element('<a></a>')
                                     .attr('target', '_blank')
                                     .attr('href', url)
                                     .append(angular.element('<img>')
                                                    .addClass('embed')
                                                    .attr('src', src));
                element.innerHTML = gelement.prop('outerHTML');
            };
        }
    });

    /*
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
    */

    /*
     * Vine plugin
     */
    var vinePlugin = new UrlPlugin('Vine', function (url) {
        var regexp = /^https?:\/\/(www\.)?vine.co\/v\/([a-zA-Z0-9]+)(\/.*)?/i,
            match = url.match(regexp);
        if (match) {
            var id = match[2], embedurl = "https://vine.co/v/" + id + "/embed/simple?audio=1";
            var element = angular.element('<iframe></iframe>')
                                 .addClass('vine-embed')
                                 .attr('src', embedurl)
                                 .attr('width', '600')
                                 .attr('height', '600')
                                 .attr('frameborder', '0');
            return element.prop('outerHTML') + '<script async src="//platform.vine.co/static/scripts/embed.js" charset="utf-8"></script>';
        }
    });

    return {
        plugins: [youtubePlugin, dailymotionPlugin, allocinePlugin, imagePlugin, videoPlugin, audioPlugin, spotifyPlugin, cloudmusicPlugin, googlemapPlugin, asciinemaPlugin, yrPlugin, giphyPlugin, vinePlugin]
    };


});
})();
