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
plugins.service('plugins', ['userPlugins', '$sce',  function(userPlugins, $sce) {

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
        var contentForMessage = function(message) {

            message.metadata = [];
            for (var i = 0; i < plugins.length; i++) {

                var nsfw = false;
                var visible = true;
                if (message.text.match(nsfwRegexp)) {
                    var nsfw = true;
                    var visible = false;
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

    var youtubePlugin = new Plugin(function(message) {

        if (message.indexOf('youtube.com') != -1) {
            var index = message.indexOf("?v=");
            var token = message.substr(index+3);
            return '<iframe width="560" height="315" src="http://www.youtube.com/embed/' + token + '" frameborder="0" allowfullscreen></iframe>'
        }

        return null;
    });
    youtubePlugin.name = 'youtube video';

    var imagePlugin = new Plugin(function(message) {
        
        var url = message.match(urlRegexp);

	if (url) {
	    var url = url[0]; /* Actually parse one url per message */
            if (url.match(/png$|gif$|jpg$|jpeg$/)) {
	        return '<img src="' + url + '" height="300">';
            } 
        }
        return null;
    });
    imagePlugin.name = 'image';

    return {
        plugins: [youtubePlugin, imagePlugin]
    }
});
