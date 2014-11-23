(function(exports) {//

/**
 * Teddy protocol handling.
 *
 * This object parses messages and formats commands for the Teddy
 * protocol. It's independent from the communication layer and thus
 * may be used with any network mechanism.
 */
(function() {
    var TeddyProtocol = function() {
    };

    [ 'init', 'info', 'hdata', 'sync', 'input', 'nicklist' ]
	.forEach(function(format) {
	    var key = format;
	    TeddyProtocol[
		'format' + format.charAt(0).toUpperCase() + format.substr(1)
	    ] = function(params) {
		var message = {};
		message['gb.'+key] = params;
		return message;
	    };
	});
    TeddyProtocol.formatQuit = function() {
	return TeddyProtocol.formatInput({
            buffer: 'core.weechat',
            data: '/quit'
        });
    };

    TeddyProtocol._defaultColour = {
        type: 'weechat',
        name: 'default'
    };
    TeddyProtocol._defaultAttrs = {
        name: null,
        override: {
	    b /*old*/: false,
	    r /*everse*/: false,
	    i /*talic*/: false,
	    u /*nderline*/: false,
	    bl /*ink*/: false,
	    f /*ixed*/: false
        }
    };

    TeddyProtocol.rawText2Rich = function(msg) {
	var parts = msg.split(/(\x04(?:#....|[&-@\xff].|[`-i])|\x1f|\x16)/);
	if (parts.length == 1) {
	    return [ {
		text: msg,
		fgColor: TeddyProtocol._defaultColour,
		bgColor: TeddyProtocol._defaultColour,
		attrs: TeddyProtocol._defaultAttrs } ];
	}

        var curFgColor = TeddyProtocol._defaultColour.name;
        var curBgColor = TeddyProtocol._defaultColour.name;
        var curAttrs = angular.extend({}, TeddyProtocol._defaultAttrs.override);

        return parts.map(function(p) {
	    switch (p.charAt(0)) {
	    case "\x1f":
		curAttrs.u = !curAttrs.u;
		return null;
	    case "\x16":
		curAttrs.r = !curAttrs.r;
		return null;
	    case "\x04":
		switch (p.charAt(1)) {
		case 'a':
		    curAttrs.bl = !curAttrs.bl; break;
		case 'c':
		    curAttrs.b = !curAttrs.b; break;
		case 'i':
		    curAttrs.f = !curAttrs.f; break;
		case 'f':
		    curAttrs.i = !curAttrs.i; break;
		case 'g':
		    curAttrs = angular.extend({}, TeddyProtocol._defaultAttrs.override);
		    curFgColor = TeddyProtocol._defaultColour.name;
		    curBgColor = TeddyProtocol._defaultColour.name;
		    break;
		case 'e':
		    /* prefix separator */ break;
		}
		var color;
		if (['.', '-', ',', '+', "'", '&'].indexOf(p.charAt(1)) > -1) {
		    /* extended colour */
		    var ext_color_off = {
			'.' :  [false, 0x10],
			'-' :  [false, 0x60],
			',' :  [false, 0xb0],
			'+' :  [true, 0x10],
			"'" :  [true, 0x60],
			'&' :  [true, 0xb0]
		    };
		    color = ext_color_off[p.charAt(1)][1] - 0x3f + p.charCodeAt(2);
		    if (ext_color_off[p.charAt(1)][0]) {
			curBgColor = 16 + color;
		    }
		    else {
			curFgColor = 16 + color;
		    }
		}
		else if (p.charAt(1) == "#") {
		    /* html colour */
		    var rgbx = [2,3,4,5].map(function(i) { return p.charCodeAt(i); });
		    rgbx[3] -= 0x20;
		    for (var i = 0; i < 3; ++i) {
			if (rgbx[3] & (0x10 << i)) {
			    rgbx[i] -= 0x20;
			}
		    }
		    var _toHex = function (number) {
			var t = number.toString(16);
			return t.length < 2 ? '0' + t : t;
		    };
		    color = '#' + rgbx.splice(0, 3).map(function(e){
			return _toHex(e); }).join('');
		    if (rgbx[0] & 1) {
			curBgColor = color;
		    }
		    else {
			curFgColor = color;
		    }
		}
		else {
		    var colorBase = '0'.charCodeAt(0);
		    var colorBaseMax = '?'.charCodeAt(0);
		    var _ansiBitFlip = function(x) {
			return (x&8) | (x&4)>>2 | (x&2) | (x&1)<<2;
		    };
		    if (p.charCodeAt(1) >= colorBase && p.charCodeAt(1) <= colorBaseMax) {
			curFgColor = _ansiBitFlip(p.charCodeAt(1) - colorBase);
		    }
		    else if (p.charAt(1) == "\xff") {
			curFgColor = TeddyProtocol._defaultColour.name;
		    }
		    if (p.charCodeAt(2) >= colorBase && p.charCodeAt(2) <= colorBaseMax) {
			curBgColor = _ansiBitFlip(p.charCodeAt(2) - colorBase);
		    }
		    else if (p.charAt(2) == "\xff") {
			curBgColor = TeddyProtocol._defaultColour.name;
		    }
		}
		return null;
	    }
	    var ret = {
		bgColor: { name: curBgColor },
		attrs: { name: null, override: {} },
		text: p
	    };
	    for (var x in curAttrs) {
		if (curAttrs[x] != TeddyProtocol._defaultAttrs.override[x]) {
		    ret.attrs.override[x] = curAttrs[x];
		}
	    }
	    ret.fgColor = curFgColor == TeddyProtocol._defaultColour.name ? TeddyProtocol._defaultColour : { type: 'ext', name: curFgColor };
	    ret.bgColor = curBgColor == TeddyProtocol._defaultColour.name ? TeddyProtocol._defaultColour : { type: 'ext', name: curBgColor };

	    return ret;
        }).filter(function(p) {
            return p !== null;
        });
	    
    };

    TeddyProtocol.canClearHotlist = true;

    TeddyProtocol.challengeAuth = true;

    TeddyProtocol.skipLines = true;

    TeddyProtocol.useTextbuffer = true;

    TeddyProtocol.mountpoint = '/teddy';

    TeddyProtocol.prototype.setId = function(id, message) {
        return JSON.stringify(angular.extend({}, message, {id: id}));
    };

    TeddyProtocol.prototype.parse = function(data) {
	var ret = JSON.parse(data);
	[ 'gb.hdata', 'gb.nicklist' ].forEach(function(key) {
	    if (ret[key]) {
		ret.objects = [ { content: ret[key] } ];
		delete ret[key];
		return;
	    }
	});
	if ('string' === typeof ret.id) {
	  ret.id = ret.id.replace(/^gb\._/,'_');
	}
	return ret;
    };

    exports.Protocol = TeddyProtocol;
})();
})(typeof exports === "undefined" ? this.Teddy = {} : exports);
