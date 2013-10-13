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
plugins.service('plugins', ['userPlugins', '$sce',  function(userPlugins, $sce) {

    var nsfwRegexp = new RegExp('nsfw$', 'i');

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
        var contentForMessage = function(message) {

            var content = [];
            for (var i = 0; i < plugins.length; i++) {

                var nsfw = false;
                var visible = true;
                if (message.match(nsfwRegexp)) {
                    var nsfw = true;
                    var visible = false;
                }

                var pluginContent = plugins[i].contentForMessage(message);
                if (pluginContent) {
                    var pluginContent = {'visible': visible,
                                         'content': $sce.trustAsHtml(pluginContent),
                                         'nsfw': nsfw }

                    content.push(pluginContent);

                    if (plugins[i].exclusive) {
                        break;
                    }
                }
            }
            return content;
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

    var youtubePlugin = new Plugin(function(message) {

        if (message.indexOf('youtube.com') != -1) {
            var index = message.indexOf("?v=");
            var token = message.substr(index+3);
            return '<iframe width="560" height="315" src="http://www.youtube.com/embed/' + token + '" frameborder="0" allowfullscreen></iframe>'
        }

        return null;
    });

    var urlPlugin = new Plugin(function(message) {
        var urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
        var url = message.match(urlPattern);
        if (url) {
            return '<a target="_blank" href="' + url[0] + '">' + message + '</a>';
        }
        return null;

    });

    var imagePlugin = new Plugin(function(message) {
	var urls = message.match(/https?:\/\/[^\s]*\.(jpg|png|gif)\b/)
	if (urls != null) {
	    var url = urls[0]; /* Actually parse one url per message */
	    return '<img src="' + url + '" height="300">';
        }
        return null;
    });

    return {
        plugins: [youtubePlugin, urlPlugin, imagePlugin]
    }
});
