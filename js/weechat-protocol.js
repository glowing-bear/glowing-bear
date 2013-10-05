var WeeChatProtocol = function() {
    this._types = {
        'chr': this._getChar,
        'int': this._getInt,
        'str': this._getString,
        'inf': this._getInfo,
        'hda': this._getHdata,
        'ptr': this._getPointer,
        'lon': this._getStrNumber,
        'tim': this._getTime,
        'buf': this._getString,
        'arr': this._getArray
    };
};
WeeChatProtocol._uia2s = function(uia) {
    var str = [];

    for (var c = 0; c < uia.length; c++) {
        str.push(String.fromCharCode(uia[c]));
    }

    return decodeURIComponent(escape(str.join('')));
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
    _getStrNumber: function() {
        var len = new Uint8Array(this._getSlice(1))[0];
        var str = this._getSlice(len);

        return WeeChatProtocol._uia2s(new Uint8Array(str));
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
        return this._getStrNumber();
    },
    _getTime: function() {
        var str = this._getStrNumber();
        
        return new Date(parseInt(str));
    },
    _getInt: function() {
        var parsedData = new Uint8Array(this._getSlice(4));

        return ((parsedData[0] & 0xff) << 24) |
            ((parsedData[1] & 0xff) << 16) |
            ((parsedData[2] & 0xff) << 8) |
            (parsedData[3] & 0xff);
    },
    _getChar: function() {
        var parsedData = new Uint8Array(this._getSlice(1));

        return parsedData[0];
    },
    _getString: function() {
        var l = this._getInt();

        if (l > 0) {
            var s = this._getSlice(l);
            var parsedData = new Uint8Array(s);

            return WeeChatProtocol._uia2s(parsedData);
        }

        return "";
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
            return {
                type: type,
                content: self._runType(type),
            };
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
    _getSlice: function(length) {
        var slice = this._data.slice(this._dataAt, this._dataAt + length);

        this._dataAt += length;

        return slice;
    },
    _setData: function (data) {
        this._data = data;
    },
    parse: function(data) {
        var self = this;

        this._setData(data);
        this._dataAt = 0;

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
