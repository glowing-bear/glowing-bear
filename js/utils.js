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

    // Convert string to ByteArray
    function hexStringToByte(str) {
        if (!str) {
          return new Uint8Array();
        }
        
        var a = [];
        for (var i = 0, len = str.length; i < len; i+=2) {
          a.push(parseInt(str.substr(i,2),16));
        }
        
        return new Uint8Array(a);
    }

    function bytetoHexString(buffer) {
        return Array
        .from (new Uint8Array (buffer))
        .map (b => b.toString (16).padStart (2, "0"))
        .join ("");
      }

    function stringToUTF8Array(string) {
        const encoder = new TextEncoder()
        const view = encoder.encode(string)
        return view;
    }

    function concatenateTypedArray(a, b) { // a, b TypedArray of same type
        var c = new (a.constructor)(a.length + b.length);
        c.set(a, 0);
        c.set(b, a.length);
        return c;
    }


    return {
    	changeClassStyle: changeClassStyle,
    	getClassStyle: getClassStyle,
        isMobileUi: isMobileUi,
        isCordova: isCordova,
        inject_script: inject_script,
        inject_css: inject_css,
        hexStringToByte: hexStringToByte,
        bytetoHexString: bytetoHexString,
        stringToUTF8Array: stringToUTF8Array,
        concatenateTypedArray: concatenateTypedArray
    };
});
