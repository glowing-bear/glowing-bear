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

    return {
    	changeClassStyle: changeClassStyle,
    	getClassStyle: getClassStyle,
    	isMobileUi: isMobileUi
    };
});
