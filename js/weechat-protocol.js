var WeeChatProtocol = function() {
    this._types = {
        'chr': this._getChar,
        'int': this._getInt,
        'str': this._getString,
        'inf': this._getInfo,
        'hda': this._getHdata,
        'ptr': this._getPointer,
        'lon': this._getPointer,
        'tim': this._getPointer,
        'buf': this._getString,
        'arr': this._getArray
    };
};
WeeChatProtocol._uia2s = function(uia) {
    var _str = [];

    for (var c = 0; c < uia.length; c++) {
        _str[c] = String.fromCharCode(uia[c]);
    }

    return decodeURIComponent(escape(_str.join("")));
};
WeeChatProtocol.prototype = {
    _getType: function() {
        var t = this._getSlice(3);

        return WeeChatProtocol._uia2s(new Uint8Array(t));
    },
    _runType: function(type) {
        var cb = this._types[type];
        var boundCb = cb.bind(this);

        return boundCb();
    },
    _getInfo: function() {
        var info = {};
        info.key = this._getString();
        info.value = this._getString();

        return info;
    },
    _getHdata: function() {
        var self = this;
        var paths;
        var count;
        var objs = [];
        var hpath = this._getString();

        keys = this._getString().split(',');
        paths = hpath.split('/');
        count = this._getInt();

        keys = keys.map(function(key) {
            return key.split(':');
        });

        for (var i = 0; i < count; i++) {
            var tmp = {};

            tmp.pointers = paths.map(function(path) {
                return self._getPointer();
            });
            keys.forEach(function(key) {
                tmp[key[0]] = self._runType(key[1]);
            });
            objs.push(tmp);
        };

        return objs;
    },
    _getPointer: function() {
        var l = this._getChar();
        var pointer = this._getSlice(l)
        var parsed_data = new Uint8Array(pointer);

        return WeeChatProtocol._uia2s(parsed_data);
    },
    _getInt: function() {
        var parsed_data = new Uint8Array(this._getSlice(4));

        return ((parsed_data[0] & 0xff) << 24) |
            ((parsed_data[1] & 0xff) << 16) |
            ((parsed_data[2] & 0xff) << 8) |
            (parsed_data[3] & 0xff);
    },
    _getChar: function() {
        var parsed_data = new Uint8Array(this._getSlice(1));

        return parsed_data[0];
    },
    _getString: function() {
        var l = this._getInt();

        if (l > 0) {
            var s = this._getSlice(l);
            var parsed_data = new Uint8Array(s);

            return WeeChatProtocol._uia2s(parsed_data);
        }

        return "";
    },
    _getSlice: function(length) {
        var slice = this.data.slice(0,length);

        this.data = this.data.slice(length);

        return slice;
    },
    _getHeader: function() {
        var len = this._getInt();
        var comp = this._getChar();

        return {
            length: len,
            compression: comp,
        };
    },
    _getId: function() {
        return this._getString();
    },
    _getObject: function() {
        var self = this;
        var type = this._getType();

        if (type) {
            return object = {
                type: type,
                content: self._runType(type),
            }
        }
    },
    _getArray: function() {
        var self = this;
        var type;
        var count;
        var values;

        type = this._getType();
        count = this._getInt();
        values = [];

        for (var i = 0; i < count; i++) {
            values.push(self._runType(type));
        };

        return values;
    },
    _setData: function (data) {
        this.data = data;
    },
    parse: function(data) {
        var self = this;
        this._setData(data);

        var header = this._getHeader();
        var id = this._getId();
        var objects = [];
        var object = this._getObject();

        while (object) {
            objects.push(object);
            object = self._getObject();
        }

        return {
            header: header,
            id: id,
            objects: objects,
        };
    }
};
