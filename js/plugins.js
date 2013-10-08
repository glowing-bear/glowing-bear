var plugins = angular.module('plugins', []);


plugins.service('plugins', function() {

    this.Plugin = function(contentForMessage) {
        
        return {
            contentForMessage: contentForMessage,
            exclusive: false,
        }
    }
    
});


plugins.factory('pluginManager', ['youtubePlugin', 'urlPlugin', 'imagePlugin', function(youtubePlugin, urlPlugin, imagePlugin) {


    var plugins = [youtubePlugin, urlPlugin, imagePlugin]

    var hookPlugin = function(plugin) {
        plugins.push(plugin);
    }

    var contentForMessage = function(message) {

        var content = [];
        for (var i = 0; i < plugins.length; i++) {
            var pluginContent = plugins[i].contentForMessage(message);
            if (pluginContent) {
                var pluginContent = {'visible': false, 'content': pluginContent }
                content.push(pluginContent);

                if (plugins[i].exclusive) {
                    break;
                }
            }
        }

        return content;
    }

    return {
        hookPlugin: hookPlugin,
        contentForMessage: contentForMessage
    }

}]);

plugins.factory('youtubePlugin', [function() {

    var contentForMessage = function(message) {
        if (message.indexOf('youtube.com') != -1) {
            var index = message.indexOf("?v=");
            var token = message.substr(index+3);
            return '<iframe width="560" height="315" src="http://www.youtube.com/embed/' + token + '" frameborder="0" allowfullscreen></iframe>'
        }
        return null;
    }

    return {
        contentForMessage: contentForMessage,
        exclusive: true
    }

}]);

plugins.factory('urlPlugin', [function() {
    var contentForMessage = function(message) {
        var urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
        var url = message.match(urlPattern);
        if (url) {
            return '<a href="' + url[0] + '">' + message + '</a>';
        }
        return null;
    }

    return {
        contentForMessage: contentForMessage,
        exclusive: false
    }
}]);

plugins.factory('imagePlugin', [function() {
    var contentForMessage = function(message) {
		var urls = message.match(/https?:\/\/[^\s]*\.(jpg|png|gif)\b/)
		if (urls != null) {
			var url = urls[0]; /* Actually parse one url per message */
			return '<img src="' + url + '" height="300">';
        }
        return null;
    }

    return {
        contentForMessage: contentForMessage
    }
}]);

