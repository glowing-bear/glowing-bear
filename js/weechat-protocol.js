/**
 * WeeChat protocol handling.
 *
 * This object parses messages and formats commands for the WeeChat
 * protocol. It's independent from the communication layer and thus
 * may be used with any network mechanism.
 */
var WeeChatProtocol = function() {
    // specific parsing for each message type
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
        'arr': this._getArray,
        'htb': this._getHashTable,
        'inl': function() {
            this._warnUnimplemented('infolist');
        }
    };

    // string value for some message types
    this._typesStr = {
        'chr': this._strDirect,
        'str': this._strDirect,
        'int': this._strToString,
        'tim': this._strToString,
        'ptr': this._strDirect
    };
};

/**
 * Unsigned integer array to string.
 *
 * @param uia Unsigned integer array
 * @return Decoded string
 */
WeeChatProtocol._uia2s = function(uia) {
    var str = [];

    for (var c = 0; c < uia.length; c++) {
        str.push(String.fromCharCode(uia[c]));
    }

    return decodeURIComponent(escape(str.join('')));
};

/**
 * Merges default parameters with overriding parameters.
 *
 * @param defaults Default parameters
 * @param override Overriding parameters
 * @return Merged parameters
 */
WeeChatProtocol._mergeParams = function(defaults, override) {
    for (var v in override) {
        defaults[v] = override[v];
    }

    return defaults;
}

/**
 * Formats a command.
 *
 * @param id Command ID (null for no ID)
 * @param name Command name
 * @param parts Command parts
 * @return Formatted command string
 */
WeeChatProtocol._formatCmd = function(id, name, parts) {
    var cmdIdName;
    var cmd;

    cmdIdName = (id !== null) ? '(' + id + ') ' : '';
    cmdIdName += name;
    parts.unshift(cmdIdName);
    cmd = parts.join(' ');
    cmd += '\n';

    return cmd;
};

/**
 * Formats an init command.
 *
 * @param params Parameters:
 *      password: password (optional)
 *      compression: compression ('off' or 'zlib') (optional)
 * @return Formatted init command string
 */
WeeChatProtocol.formatInit = function(params) {
    var defaultParams = {
        password: null,
        compression: 'off'
    };
    var keys = [];
    var parts = [];

    params = WeeChatProtocol._mergeParams(defaultParams, params);
    keys.push('compression=' + params.compression);
    if (params.password !== null) {
        keys.push('password=' + params.password);
    }
    parts.push(keys.join(','));

    return WeeChatProtocol._formatCmd(null, 'init', parts);
};

/**
 * Formats an hdata command.
 *
 * @param params Parameters:
 *      id: command ID (optional)
 *      path: hdata path (mandatory)
 *      keys: array of keys (optional)
 * @return Formatted hdata command string
 */
WeeChatProtocol.formatHdata = function(params) {
    var defaultParams = {
        id: null,
        keys: null
    };
    var parts = [];

    params = WeeChatProtocol._mergeParams(defaultParams, params);
    parts.push(params.path);
    if (params.keys !== null) {
        parts.push(params.keys.join(','));
    }

    return WeeChatProtocol._formatCmd(params.id, 'hdata', parts);
};

/**
 * Formats an info command.
 *
 * @param params Parameters:
 *      id: command ID (optional)
 *      name: info name (mandatory)
 * @return Formatted info command string
 */
WeeChatProtocol.formatInfo = function(params) {
    var defaultParams = {
        id: null
    };
    var parts = [];

    params = WeeChatProtocol._mergeParams(defaultParams, params);
    parts.push(params.name);

    return WeeChatProtocol._formatCmd(params.id, 'info', parts);
};

/**
 * Formats a nicklist command.
 *
 * @param params Parameters:
 *      id: command ID (optional)
 *      buffer: buffer name (optional)
 * @return Formatted nicklist command string
 */
WeeChatProtocol.formatNicklist = function(params) {
    var defaultParams = {
        id: null,
        buffer: null
    };
    var parts = [];

    params = WeeChatProtocol._mergeParams(defaultParams, params);
    if (params.buffer !== null) {
        parts.push(params.buffer);
    }

    return WeeChatProtocol._formatCmd(params.id, 'nicklist', parts);
};

/**
 * Formats an input command.
 *
 * @param params Parameters:
 *      id: command ID (optional)
 *      buffer: target buffer (mandatory)
 *      data: input data (mandatory)
 * @return Formatted input command string
 */
WeeChatProtocol.formatInput = function(params) {
    var defaultParams = {
        id: null
    };
    var parts = [];

    params = WeeChatProtocol._mergeParams(defaultParams, params);
    parts.push(params.buffer);
    parts.push(params.data);

    return WeeChatProtocol._formatCmd(params.id, 'input', parts);
};

/**
 * Formats a sync or a desync command.
 *
 * @param params Parameters (see _formatSync and _formatDesync)
 * @return Formatted sync/desync command string
 */
WeeChatProtocol._formatSyncDesync = function(cmdName, params) {
    var defaultParams = {
        id: null,
        buffers: null,
        options: null
    };
    var parts = [];

    params = WeeChatProtocol._mergeParams(defaultParams, params);
    if (params.buffers !== null) {
        parts.push(params.buffers.join(','));
        if (params.options !== null) {
            parts.push(params.options.join(','));
        }
    }

    return WeeChatProtocol._formatCmd(params.id, cmdName, parts);
}

/**
 * Formats a sync command.
 *
 * @param params Parameters:
 *      id: command ID (optional)
 *      buffers: array of buffers to sync (optional)
 *      options: array of options (optional)
 * @return Formatted sync command string
 */
WeeChatProtocol.formatSync = function(params) {
    return WeeChatProtocol._formatSyncDesync('sync', params);
};

/**
 * Formats a desync command.
 *
 * @param params Parameters:
 *      id: command ID (optional)
 *      buffers: array of buffers to desync (optional)
 *      options: array of options (optional)
 * @return Formatted desync command string
 */
WeeChatProtocol.formatDesync = function(params) {
    return WeeChatProtocol._formatSyncDesync('desync', params);
};

/**
 * Formats a test command.
 *
 * @param params Parameters:
 *      id: command ID (optional)
 * @return Formatted test command string
 */
WeeChatProtocol.formatTest = function(params) {
    var defaultParams = {
        id: null
    };
    var parts = [];

    params = WeeChatProtocol._mergeParams(defaultParams, params);

    return WeeChatProtocol._formatCmd(params.id, 'test', parts);
};

/**
 * Formats a quit command.
 *
 * @return Formatted quit command string
 */
WeeChatProtocol.formatQuit = function() {
    return WeeChatProtocol._formatCmd(null, 'quit', []);
};

/**
 * Formats a ping command.
 *
 * @param params Parameters:
 *      id: command ID (optional)
 *      args: array of custom arguments (optional)
 * @return Formatted ping command string
 */
WeeChatProtocol.formatPing = function(params) {
    var defaultParams = {
        id: null,
        args: null
    };
    var parts = [];

    params = WeeChatProtocol._mergeParams(defaultParams, params);
    if (params.args !== null) {
        parts.push(params.args.join(' '));
    }

    return WeeChatProtocol._formatCmd(params.id, 'ping', parts);
};

WeeChatProtocol.prototype = {
    /**
     * Warns that message parsing is not implemented for a
     * specific type.
     *
     * @param type Message type to display
     */
    _warnUnimplemented: function(type) {
        console.log('Warning: ' + type + ' message parsing is not implemented');
    },

    /**
     * Reads a 3-character message type token value from current
     * set data.
     *
     * @return Type
     */
    _getType: function() {
        var t = this._getSlice(3);

        if (!t) {
            return null;
        }

        return WeeChatProtocol._uia2s(new Uint8Array(t));
    },

    /**
     * Runs the appropriate read routine for the specified message type.
     *
     * @param type Message type
     * @return Data value
     */
    _runType: function(type) {
        var cb = this._types[type];
        var boundCb = cb.bind(this);

        return boundCb();
    },

    /**
     * Reads a "number as a string" token value from current set data.
     *
     * @return Number as a string
     */
    _getStrNumber: function() {
        var len = this._getByte();
        var str = this._getSlice(len);

        return WeeChatProtocol._uia2s(new Uint8Array(str));
    },

    /**
     * Returns the passed object.
     *
     * @param obj Object
     * @return Passed object
     */
    _strDirect: function(obj) {
        return obj;
    },

    /**
     * Calls toString() on the passed object and returns the value.
     *
     * @param obj Object to call toString() on
     * @return String value of object
     */
    _strToString: function(obj) {
        return obj.toString();
    },

    /**
     * Gets the string value of an object representing the message
     * value for a specified type.
     *
     * @param obj Object for which to get the string value
     * @param type Message type
     * @return String value of object
     */
    _objToString: function(obj, type) {
        var cb = this._typesStr[type];
        var boundCb = cb.bind(this);

        return boundCb(obj);
    },

    /**
     * Reads an info token value from current set data.
     *
     * @return Info object
     */
    _getInfo: function() {
        var info = {};
        info.key = this._getString();
        info.value = this._getString();

        return info;
    },

    /**
     * Reads an hdata token value from current set data.
     *
     * @return Hdata object
     */
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

    /**
     * Reads a pointer token value from current set data.
     *
     * @return Pointer value
     */
    _getPointer: function() {
        return this._getStrNumber();
    },

    /**
     * Reads a time token value from current set data.
     *
     * @return Time value (Date)
     */
    _getTime: function() {
        var str = this._getStrNumber();

        return new Date(parseInt(str) * 1000);
    },

    /**
     * Reads an integer token value from current set data.
     *
     * @return Integer value
     */
    _getInt: function() {
        var parsedData = new Uint8Array(this._getSlice(4));

        return ((parsedData[0] & 0xff) << 24) |
            ((parsedData[1] & 0xff) << 16) |
            ((parsedData[2] & 0xff) << 8) |
            (parsedData[3] & 0xff);
    },

    /**
     * Reads a byte from current set data.
     *
     * @return Byte value (integer)
     */
    _getByte: function() {
        var parsedData = new Uint8Array(this._getSlice(1));

        return parsedData[0];
    },

    /**
     * Reads a character token value from current set data.
     *
     * @return Character (string)
     */
    _getChar: function() {
        return String.fromCharCode(this._getByte());
    },

    /**
     * Reads a string token value from current set data.
     *
     * @return String value
     */
    _getString: function() {
        var l = this._getInt();

        if (l > 0) {
            var s = this._getSlice(l);
            var parsedData = new Uint8Array(s);

            return WeeChatProtocol._uia2s(parsedData);
        }

        return "";
    },

    /**
     * Reads a message header from current set data.
     *
     * @return Header object
     */
    _getHeader: function() {
        var len = this._getInt();
        var comp = this._getByte();

        return {
            length: len,
            compression: comp,
        };
    },

    /**
     * Reads a message header ID from current set data.
     *
     * @return Message ID (string)
     */
    _getId: function() {
        return this._getString();
    },

    /**
     * Reads an arbitrary object token from current set data.
     *
     * @return Object value
     */
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

    /**
     * Reads an hash table token from current set data.
     *
     * @return Hash table
     */
    _getHashTable: function() {
        var self = this;
        var typeKeys, typeValues, count;
        var dict = {};

        typeKeys = this._getType();
        typeValues = this._getType();
        count = this._getInt();

        for (var i = 0; i < count; ++i) {
            var key = self._runType(typeKeys);
            var keyStr = self._objToString(key, typeKeys);
            var value = self._runType(typeValues);
            dict[keyStr] = value;
        }

        return dict;
    },

    /**
     * Reads an array token from current set data.
     *
     * @return Array
     */
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

    /**
     * Reads a specified number of bytes from current set data.
     *
     * @param length Number of bytes to read
     * @return Sliced array
     */
    _getSlice: function(length) {
        if (this.dataAt + length > this._data.byteLength) {
            return null;
        }

        var slice = this._data.slice(this._dataAt, this._dataAt + length);

        this._dataAt += length;

        return slice;
    },

    /**
     * Sets the current data.
     *
     * @param data Current data
     */
    _setData: function (data) {
        this._data = data;
    },

    /**
     * Parses a WeeChat message.
     *
     * @param data Message data (ArrayBuffer)
     * @return Message value
     */
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
