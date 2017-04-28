var weechat = angular.module('weechat');

weechat.factory('utils', function() {
	// Helper to change style of a class
	var changeClassStyle = function(classSelector, attr, value) {
	    _.each(document.getElementsByClassName(classSelector), function(e) {
	        e.style[attr] = value;
	    });
	};
	// Helper to get style from a class
	var getClassStyle = function(classSelector, attr) {
	    _.each(document.getElementsByClassName(classSelector), function(e) {
	        return e.style[attr];
	    });
	};

    var isMobileUi = function() {
        // TODO don't base detection solely on screen width
        // You are right. In the meantime I am renaming isMobileDevice to isMobileUi
        var mobile_cutoff = 968;
        return (document.body.clientWidth < mobile_cutoff);
    };

    var isCordova = function() {
        return window.cordova !== undefined;
    };


    // Inject a javascript (used by KaTeX)
    var inject_script = function(script_url) {
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src  = script_url;
        var head = document.getElementsByTagName("head")[0];
        head.appendChild(script);
    };
    // Inject a stylesheet (used by KaTeX and theme switching)
    var inject_css = function(css_url, id) {
        var elem = document.createElement("link");
        elem.rel = "stylesheet";
        elem.href = css_url;
        if (id)
            elem.id = id;
        var head = document.getElementsByTagName("head")[0];
        head.appendChild(elem);
    };


    return {
    	changeClassStyle: changeClassStyle,
    	getClassStyle: getClassStyle,
        isMobileUi: isMobileUi,
        isCordova: isCordova,
        inject_script: inject_script,
        inject_css: inject_css,
    };
});
