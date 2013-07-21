var Protocol = function() {
        var self = this;
        var getInfo = function() {
            var info = {};
            info.key = getString();
            info.value = getString();
            return info;
        };

        var getHdata = function() {
	    var paths;
	    var count;
	    var objs = [];
	    var hpath = getString();

	    

	    keys = getString().split(',');
	    paths = hpath.split('/');
	    count = getInt();

	    keys = keys.map(function(key) {
		return key.split(':');
	    });
	    var i;
	    for (i = 0; i < count; i++) {
		var tmp = {};

		tmp.pointers = paths.map(function(path) {
		    return getPointer();
		});

		keys.forEach(function(key) {
		    tmp[key[0]] = runType(key[1]);
		});
		objs.push(tmp);
	    };
	    return objs;
	};

        function getPointer() {
	    var l = getChar();

	    var pointer = getSlice(l)
            var parsed_data = new Uint8Array(pointer);
            return _uiatos(parsed_data);

	};

        var _uiatos =function(uia) {
            var _str = [];
            for (var c = 0; c < uia.length; c++) {
                _str[c] = String.fromCharCode(uia[c]);
            }
            return _str.join("");
        };

        var getInt = function() {
            var parsed_data = new Uint8Array(getSlice(4));
            var i = ((parsed_data[0] & 0xff) << 24) | ((parsed_data[1] & 0xff) << 16) | ((parsed_data[2] & 0xff) << 8) | (parsed_data[3] & 0xff);
            return i;
        
        };

        var getChar = function() {
            var parsed_data = new Uint8Array(getSlice(1));
            return parsed_data[0];
        };

        var getString = function() {
            var l = getInt();
            if (l > 0) {
                var s = getSlice(l);
                var parsed_data = new Uint8Array(s);
                return _uiatos(parsed_data);
            }
            return "";
        };

        var getSlice = function(length) {
            var slice = self.data.slice(0,length);
            self.data = self.data.slice(length);
            return slice;
        };

        var getType = function() {
            var t = getSlice(3);
            return _uiatos(new Uint8Array(t));
        };

        var runType = function(type) {
            if (type in types) {
                return types[type]();
            }
            0;
        };

        var getHeader = function() {
            return {
                length: getInt(),
                compression: getChar(),
            }
        };

        var getId = function() {
            return getString();
        }

        var getObject = function() {
            var type = getType();
            if (type) {
                return object = {
                    type: type,
                    content: runType(type),
                }
            }
        }

        self.parse = function() {

            var header = getHeader();
            var id = getId();
            var objects = [];
            var object = getObject();
            while(object) {
                objects.push(object);
                object = getObject();
            }
	    console.log("Received message");
	    console.log(header, id, objects);
            return {
                header: header,
                id: id,
                objects: objects,     
            }
        }

        self.setData = function (data) {
            self.data = data;
        };

        function array() {
	    var type;
	    var count;
	    var values;

	    type = getType();
	    count = getInt();
	    values = [];
	    var i;
	    for (i = 0; i < count; i++) {
		values.push(runType(type));
	    };
	    return values;
	}

        var types = {
            chr: getChar,
            "int": getInt,
            str: getString,
            inf: getInfo,
	    hda: getHdata,
	    ptr: getPointer,
	    lon: getPointer,
	    tim: getPointer,
	    buf: getString,
	    arr: array
        };
//TODO: IMPLEMENT THIS STUFF
//            chr: this.getChar,
//            'int': getInt,
            // hacks

            // hacks
//            htb: getHashtable,
//            inf: Protocol.getInfo,
//            inl: getInfolist,

//        },

}
