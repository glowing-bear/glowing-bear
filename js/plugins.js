plugins = angular.module('plugins', []);

var Plugin = function(contentForMessage) {
    
    return {
        contentForMessage: contentForMessage,
        exclusive: false,
    }
}

plugins.service('plugins', ['userPlugins', function(userPlugins) {


    var PluginManagerObject = function() {

        var plugins = [];
        var registerPlugins = function(userPlugins) {
            for (var i = 0; i < userPlugins.length; i++) {
                plugins.push(userPlugins[i]);
            };
        }

        var contentForMessage = function(message) {

            var content = [];
            for (var i = 0; i < plugins.length; i++) {
                var pluginContent = plugins[i].contentForMessage(message);
                if (pluginContent) {
                    var pluginContent = {'visible': false, 
                                         'content': pluginContent }
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

    this.PluginManager = new PluginManagerObject();
    this.PluginManager.registerPlugins(userPlugins.plugins);
}]);

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
            return '<a href="' + url[0] + '">' + message + '</a>';
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
