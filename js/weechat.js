(function(exports) {// http://weechat.org/files/doc/devel/weechat_dev.en.html#color_codes_in_strings

(function() {
  // http://weechat.org/files/doc/devel/weechat_dev.en.html#color_codes_in_strings
  var part, fg, bg, attrs;

  // XTerm 8-bit pallete
  var colors = [
      '#666666', '#AA0000', '#00AA00', '#AA5500', '#0000AA',
      '#AA00AA', '#00AAAA', '#AAAAAA', '#555555', '#FF5555',
      '#55FF55', '#FFFF55', '#5555FF', '#FF55FF', '#55FFFF',
      '#FFFFFF', '#666666', '#00005F', '#000087', '#0000AF',
      '#0000D7', '#0000FF', '#005F00', '#005F5F', '#005F87',
      '#005FAF', '#005FD7', '#005FFF', '#008700', '#00875F',
      '#008787', '#0087AF', '#0087D7', '#00AF00', '#00AF5F',
      '#00AF87', '#00AFAF', '#00AFD7', '#00AFFF', '#00D700',
      '#00D75F', '#00D787', '#00D7AF', '#00D7D7', '#00D7FF',
      '#00FF00', '#00FF5F', '#00FF87', '#00FFAF', '#00FFD7',
      '#00FFFF', '#5F0000', '#5F005F', '#5F0087', '#5F00AF',
      '#5F00D7', '#5F00FF', '#5F5F00', '#5F5F5F', '#5F5F87',
      '#5F5FAF', '#5F5FD7', '#5F5FFF', '#5F8700', '#5F875F',
      '#5F8787', '#5F87AF', '#5F87D7', '#5F87FF', '#5FAF00',
      '#5FAF5F', '#5FAF87', '#5FAFAF', '#5FAFD7', '#5FAFFF',
      '#5FD700', '#5FD75F', '#5FD787', '#5FD7AF', '#5FD7D7',
      '#5FD7FF', '#5FFF00', '#5FFF5F', '#5FFF87', '#5FFFAF',
      '#5FFFD7', '#5FFFFF', '#870000', '#87005F', '#870087',
      '#8700AF', '#8700D7', '#8700FF', '#875F00', '#875F5F',
      '#875F87', '#875FAF', '#875FD7', '#875FFF', '#878700',
      '#87875F', '#878787', '#8787AF', '#8787D7', '#8787FF',
      '#87AF00', '#87AF5F', '#87AF87', '#87AFAF', '#87AFD7',
      '#87AFFF', '#87D700', '#87D75F', '#87D787', '#87D7AF',
      '#87D7D7', '#87D7FF', '#87FF00', '#87FF5F', '#87FF87',
      '#87FFAF', '#87FFD7', '#87FFFF', '#AF0000', '#AF005F',
      '#AF0087', '#AF00AF', '#AF00D7', '#AF00FF', '#AF5F00',
      '#AF5F5F', '#AF5F87', '#AF5FAF', '#AF5FD7', '#AF5FFF',
      '#AF8700', '#AF875F', '#AF8787', '#AF87AF', '#AF87D7',
      '#AF87FF', '#AFAF00', '#AFAF5F', '#AFAF87', '#AFAFAF',
      '#AFAFD7', '#AFAFFF', '#AFD700', '#AFD75F', '#AFD787',
      '#AFD7AF', '#AFD7D7', '#AFD7FF', '#AFFF00', '#AFFF5F',
      '#AFFF87', '#AFFFAF', '#AFFFD7', '#AFFFFF', '#D70000',
      '#D7005F', '#D70087', '#D700AF', '#D700D7', '#D700FF',
      '#D75F00', '#D75F5F', '#D75F87', '#D75FAF', '#D75FD7',
      '#D75FFF', '#D78700', '#D7875F', '#D78787', '#D787AF',
      '#D787D7', '#D787FF', '#D7AF00', '#D7AF5F', '#D7AF87',
      '#D7AFAF', '#D7AFD7', '#D7AFFF', '#D7D700', '#D7D75F',
      '#D7D787', '#D7D7AF', '#D7D7D7', '#D7D7FF', '#D7FF00',
      '#D7FF5F', '#D7FF87', '#D7FFAF', '#D7FFD7', '#D7FFFF',
      '#FF0000', '#FF005F', '#FF0087', '#FF00AF', '#FF00D7',
      '#FF00FF', '#FF5F00', '#FF5F5F', '#FF5F87', '#FF5FAF',
      '#FF5FD7', '#FF5FFF', '#FF8700', '#FF875F', '#FF8787',
      '#FF87AF', '#FF87D7', '#FF87FF', '#FFAF00', '#FFAF5F',
      '#FFAF87', '#FFAFAF', '#FFAFD7', '#FFAFFF', '#FFD700',
      '#FFD75F', '#FFD787', '#FFD7AF', '#FFD7D7', '#FFD7FF',
      '#FFFF00', '#FFFF5F', '#FFFF87', '#FFFFAF', '#FFFFD7',
      '#FFFFFF', '#080808', '#121212', '#1C1C1C', '#262626',
      '#303030', '#3A3A3A', '#444444', '#4E4E4E', '#585858',
      '#626262', '#6C6C6C', '#767676', '#808080', '#8A8A8A',
      '#949494', '#9E9E9E', '#A8A8A8', '#B2B2B2', '#BCBCBC',
      '#C6C6C6', '#D0D0D0', '#DADADA', '#E4E4E4', '#EEEEEE'
  ];

  // Push the basic color list on top of the extended color list
  // and then when weechat requests a basic color (0-15) we rewrite 
  // it to be a number in the extended color table
  colors.push.apply(colors, ['', 'black', 'darkgray', 'darkred', 'red', 'darkgreen', 'lightgreen', 'brown',
      'yellow', 'darkblue', 'lightblue', 'darkmagenta', 'magenta', 'darkcyan', 'lightcyan', 'gray', 'white'
  ]);

  function setAttrs() {
    while (part.match(/^[\*\/\_\|]/)) {
      attrs.push(part.charAt(0));
      part = part.slice(1);
    }
  }

  function getColor() {
    var c;
    if (part.match(/^@/)) {
      c = part.slice(1, 6);
      part = part.slice(6);
    } else {
      c = part.slice(0, 2);
      // Rewrite the basic color value to the part in the extended
      // palette where we store the basic colors
      c = parseInt(c, 10) + 255;
      part = part.slice(2);
    }
    return c;
  }

  function prepareCss(color) {
    /*
     * Translates a weechat color to CSS
     */
    return 'color: ' + color;
  }

  var prefixes = {
    '\x19': function() {
      if (part.match(/^F/)) {
        part = part.slice(1);
        setAttrs();
        fg = getColor();
      } else if (part.match(/^B/)) {
        part = part.slice(1);
        setAttrs();
        bg = getColor();
      } else {
        setAttrs();
        fg = getColor();
        if (part.match(/^,/)) {
          part = part.slice(1);
          bg = getColor();
        }
      }
    },
    '\x1A': function() {
      // Don't know what to do
    },
    '\x1B': function() {
      attrs = [];
    },
    '\x1C': function() {
      fg = '';
      bg = '';
    }
  };

  function parse(text) {
    if (!text) {
      return text;
    }
    var f, parts = text.split(/(\x19|\x1A|\x1B|\x1C)/);
    if (parts.length === 1) return [{
        text: parts[0]
      }];
    attrs = [];

    return parts.map(function(p) {
      var res, tmp = prefixes[p.charAt(0)];
      if (f) {
        part = p;
        f();
        res = {
          text: part,
          fg: colors[parseInt(fg, 10)],
          bg: colors[parseInt(bg, 10)],
          attrs: attrs
        };
        if (!res.fg) res.fg = fg;
        if (!res.bg) res.bg = bg;
      }
      f = tmp;
      return res;
    }).filter(function(p) {
      return p;
    });
  }

  exports.color = {
    prepareCss: prepareCss,
    parse: parse
  };
})();
;/**
 * WeeChat protocol handling.
 *
 * This object parses messages and formats commands for the WeeChat
 * protocol. It's independent from the communication layer and thus
 * may be used with any network mechanism.
 */

(function() {
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
  };

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
  };

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

      function runType() {
        var tmp = {};

        tmp.pointers = paths.map(function(path) {
          return self._getPointer();
        });
        keys.forEach(function(key) {
          tmp[key[0]] = self._runType(key[1]);
        });
        objs.push(tmp);
      }

      for (var i = 0; i < count; i++) {
        runType();
      }

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

      return new Date(parseInt(str, 10) * 1000);
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
      return this._getByte();
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
      }

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
    _setData: function(data) {
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

  exports.Protocol = WeeChatProtocol;
})();
})(typeof exports === "undefined" ? this.weeChat = {} : exports)