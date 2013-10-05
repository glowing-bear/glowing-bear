var WeeChatProtocol = function() {
    this.types = {
        'chr': this.getChar,
        'int': this.getInt,
        'str': this.getString,
        'inf': this.getInfo,
        'hda': this.getHdata,
        'ptr': this.getPointer,
        'lon': this.getPointer,
        'tim': this.getPointer,
        'buf': this.getString,
        'arr': this.getArray
    };
};
WeeChatProtocol._uiatos = function(uia) {
    var _str = [];
    for (var c = 0; c < uia.length; c++) {
        _str[c] = String.fromCharCode(uia[c]);
    }

    return decodeURIComponent(escape(_str.join("")));
};
WeeChatProtocol.prototype = {
    getInfo: function() {
        var info = {};
        info.key = this.getString();
        info.value = this.getString();

        return info;
    },
    getHdata: function() {
        var self = this;
        var paths;
        var count;
        var objs = [];
        var hpath = this.getString();

        keys = this.getString().split(',');
        paths = hpath.split('/');
        count = this.getInt();

        keys = keys.map(function(key) {
            return key.split(':');
        });

        for (var i = 0; i < count; i++) {
            var tmp = {};

            tmp.pointers = paths.map(function(path) {
                return self.getPointer();
            });
            keys.forEach(function(key) {
                tmp[key[0]] = self.runType(key[1]);
            });
            objs.push(tmp);
        };

        return objs;
    },
    getPointer: function() {
        var l = this.getChar();
        var pointer = this.getSlice(l)
        var parsed_data = new Uint8Array(pointer);

        return WeeChatProtocol._uiatos(parsed_data);
    },
    getInt: function() {
        var parsed_data = new Uint8Array(this.getSlice(4));

        return ((parsed_data[0] & 0xff) << 24) |
            ((parsed_data[1] & 0xff) << 16) |
            ((parsed_data[2] & 0xff) << 8) |
            (parsed_data[3] & 0xff);
    },
    getChar: function() {
        var parsed_data = new Uint8Array(this.getSlice(1));

        return parsed_data[0];
    },
    getString: function() {
        var l = this.getInt();

        if (l > 0) {
            var s = this.getSlice(l);
            var parsed_data = new Uint8Array(s);

            return WeeChatProtocol._uiatos(parsed_data);
        }

        return "";
    },
    getSlice: function(length) {
        var slice = this.data.slice(0,length);

        this.data = this.data.slice(length);

        return slice;
    },
    getType: function() {
        var t = this.getSlice(3);

        return WeeChatProtocol._uiatos(new Uint8Array(t));
    },
    runType: function(type) {
        var cb = this.types[type];
        var boundCb = cb.bind(this);

        return boundCb();
    },
    getHeader: function() {
        var len = this.getInt();
        var comp = this.getChar();

        return {
            length: len,
            compression: comp,
        };
    },
    getId: function() {
        return this.getString();
    },
    getObject: function() {
        var self = this;
        var type = this.getType();

        if (type) {
            return object = {
                type: type,
                content: self.runType(type),
            }
        }
    },
    parse: function(data) {
        var self = this;
        this.setData(data);

        var header = this.getHeader();
        var id = this.getId();
        var objects = [];
        var object = this.getObject();

        while (object) {
            objects.push(object);
            object = self.getObject();
        }

        return {
            header: header,
            id: id,
            objects: objects,
        };
    },
    setData: function (data) {
        this.data = data;
    },
    getArray: function() {
        var self = this;
        var type;
        var count;
        var values;

        type = this.getType();
        count = this.getInt();
        values = [];

        for (var i = 0; i < count; i++) {
            values.push(self.runType(type));
        };

        return values;
    }
};
