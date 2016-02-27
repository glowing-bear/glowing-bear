(function(exports) {// http://weechat.org/files/doc/devel/weechat_dev.en.html#color_codes_in_strings
'use strict';

/**
 * WeeChat protocol handling.
 *
 * This object parses messages and formats commands for the WeeChat
 * protocol. It's independent from the communication layer and thus
 * may be used with any network mechanism.
 */
(function() {
    var WeeChatProtocol = function() {
        // specific parsing for each object type
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
            'inl': this._getInfolist,
        };

        // string value for some object types
        this._typesStr = {
            'chr': this._strDirect,
            'str': this._strDirect,
            'int': this._strToString,
            'tim': this._strToString,
            'ptr': this._strDirect
        };
    };

    /**
     * WeeChat colors names.
     */
    WeeChatProtocol._weeChatColorsNames = [
        'default',
        'black',
        'darkgray',
        'red',
        'lightred',
        'green',
        'lightgreen',
        'brown',
        'yellow',
        'blue',
        'lightblue',
        'magenta',
        'lightmagenta',
        'cyan',
        'lightcyan',
        'gray',
        'white'
    ];

    /**
     * Style options names.
     */
    WeeChatProtocol._colorsOptionsNames = [
        'separator',
        'chat',
        'chat_time',
        'chat_time_delimiters',
        'chat_prefix_error',
        'chat_prefix_network',
        'chat_prefix_action',
        'chat_prefix_join',
        'chat_prefix_quit',
        'chat_prefix_more',
        'chat_prefix_suffix',
        'chat_buffer',
        'chat_server',
        'chat_channel',
        'chat_nick',
        'chat_nick_self',
        'chat_nick_other',
        'invalid',
        'invalid',
        'invalid',
        'invalid',
        'invalid',
        'invalid',
        'invalid',
        'invalid',
        'invalid',
        'invalid',
        'chat_host',
        'chat_delimiters',
        'chat_highlight',
        'chat_read_marker',
        'chat_text_found',
        'chat_value',
        'chat_prefix_buffer',
        'chat_tags',
        'chat_inactive_window',
        'chat_inactive_buffer',
        'chat_prefix_buffer_inactive_buffer',
        'chat_nick_offline',
        'chat_nick_offline_highlight',
        'chat_nick_prefix',
        'chat_nick_suffix',
        'emphasis',
        'chat_day_change'
    ];

    /**
     * Gets the default color.
     *
     * @return Default color
     */
    WeeChatProtocol._getDefaultColor = function() {
        return {
            type: 'weechat',
            name: 'default'
        };
    };

    /**
     * Gets the default attributes.
     *
     * @return Default attributes
     */
    WeeChatProtocol._getDefaultAttributes = function() {
        return {
            name: null,
            override: {
                'bold': false,
                'reverse': false,
                'italic': false,
                'underline': false
            }
        };
    };

    /**
     * Gets the default style (default colors and attributes).
     *
     * @return Default style
     */
    WeeChatProtocol._getDefaultStyle = function() {
        return {
            fgColor: WeeChatProtocol._getDefaultColor(),
            bgColor: WeeChatProtocol._getDefaultColor(),
            attrs: WeeChatProtocol._getDefaultAttributes()
        };
    };

    /**
     * Clones a color object.
     *
     * @param color Color object to clone
     * @return Cloned color object
     */
    WeeChatProtocol._cloneColor = function(color) {
        var clone = {};

        for (var key in color) {
            clone[key] = color[key];
        }

        return clone;
    };

    /**
     * Clones an attributes object.
     *
     * @param attrs Attributes object to clone
     * @return Cloned attributes object
     */
    WeeChatProtocol._cloneAttrs = function(attrs) {
        var clone = {};

        clone.name = attrs.name;
        clone.override = {};
        for (var attr in attrs.override) {
            clone.override[attr] = attrs.override[attr];
        }

        return clone;
    };

    /**
     * Gets the name of an attribute from its character.
     *
     * @param ch Character of attribute
     * @return Name of attribute
     */
    WeeChatProtocol._attrNameFromChar = function(ch) {
        var chars = {
            // WeeChat protocol
            '*': 'b',
            '!': 'r',
            '/': 'i',
            '_': 'u',

            // some extension often used (IRC?)
            '\x01': 'b',
            '\x02': 'r',
            '\x03': 'i',
            '\x04': 'u'
        };

        if (ch in chars) {
            return chars[ch];
        }

        return null;
    };


    /**
     * Gets an attributes object from a string of attribute characters.
     *
     * @param str String of attribute characters
     * @return Attributes object (null if unchanged)
     */
    WeeChatProtocol._attrsFromStr = function(str) {
        var attrs = WeeChatProtocol._getDefaultAttributes();

        for (var i = 0; i < str.length; ++i) {
            var ch = str.charAt(i);
            if (ch === '|') {
                // means keep attributes, so unchanged
                return null;
            }
            var attrName = WeeChatProtocol._attrNameFromChar(ch);
            if (attrName !== null) {
                attrs.override[attrName] = true;
            }
        }

        return attrs;
    };

    /**
     * Gets a single color from a string representing its index (WeeChat and
     * extended colors only, NOT colors options).
     *
     * @param str Color string (e.g., "05" or "00134")
     * @return Color object
     */
    WeeChatProtocol._getColorObj = function(str) {
        if (str.length === 2) {
            var code = parseInt(str);
            if (code > 16) {
                // should never happen
                return WeeChatProtocol._getDefaultColor();
            } else {
                return {
                    type: 'weechat',
                    name: WeeChatProtocol._weeChatColorsNames[code]
                };
            }
        } else {
            var codeStr = str.substring(1);
            return {
                type: 'ext',
                name: parseInt(codeStr).toString()
            };
        }
    };

    /**
     * Gets colors and attributes of text element.
     *
     * See <http://www.weechat.org/files/doc/devel/weechat_dev.en.html#color_codes_in_strings>.
     *
     * @param txt Text element
     * @return Colors, attributes and plain text of this text element:
     *          fgColor: Foreground color (null if unchanged)
     *          bgColor: Background color (null if unchanged)
     *          attrs: Attributes (null if unchanged)
     *          text: Plain text element
     */
    WeeChatProtocol._getStyle = function(txt) {
        var matchers = [
            {
                // color option
                //   STD
                regex: /^(\d{2})/,
                fn: function(m) {
                    var ret = {};
                    var optionCode = parseInt(m[1]);

                    if (optionCode >= WeeChatProtocol._colorsOptionsNames.length) {
                        // should never happen
                        return {
                            fgColor: null,
                            bgColor: null,
                            attrs: null
                        };
                    }
                    var optionName = WeeChatProtocol._colorsOptionsNames[optionCode];
                    ret.fgColor = {
                        type: 'option',
                        name: optionName
                    };
                    ret.bgColor = WeeChatProtocol._cloneColor(ret.fgColor);
                    ret.attrs = {
                        name: optionName,
                        override: {}
                    };

                    return ret;
                }
            },
            {
                // ncurses pair
                //   EXT
                regex: /^@(\d{5})/,
                fn: function(m) {
                    // unimplemented case
                    return {
                        fgColor: null,
                        bgColor: null,
                        attrs: null
                    };
                }
            },
            {
                // foreground color with F
                //   "F" + (A)STD
                //   "F" + (A)EXT
                regex: /^F(?:([*!\/_|]*)(\d{2})|@([\x01\x02\x03\x04*!\/_|]*)(\d{5}))/,
                fn: function(m) {
                    var ret = {
                        bgColor: null
                    };

                    if (m[2]) {
                        ret.attrs = WeeChatProtocol._attrsFromStr(m[1]);
                        ret.fgColor = WeeChatProtocol._getColorObj(m[2]);
                    } else {
                        ret.attrs = WeeChatProtocol._attrsFromStr(m[3]);
                        ret.fgColor = WeeChatProtocol._getColorObj(m[4]);
                    }

                    return ret;
                }
            },
            {
                // background color (no attributes)
                //   "B" + STD
                //   "B" + EXT
                regex: /^B(\d{2}|@\d{5})/,
                fn: function(m) {
                    return {
                        fgColor: null,
                        bgColor: WeeChatProtocol._getColorObj(m[1]),
                        attrs: null
                    };
                }
            },
            {
                // foreground, background (+ attributes)
                //   "*" + (A)STD + "," + STD
                //   "*" + (A)STD + "," + EXT
                //   "*" + (A)EXT + "," + STD
                //   "*" + (A)EXT + "," + EXT
                regex: /^\*(?:([\x01\x02\x03\x04*!\/_|]*)(\d{2})|@([\x01\x02\x03\x04*!\/_|]*)(\d{5})),(\d{2}|@\d{5})/,
                fn: function(m) {
                    var ret = {};

                    if (m[2]) {
                        ret.attrs = WeeChatProtocol._attrsFromStr(m[1]);
                        ret.fgColor = WeeChatProtocol._getColorObj(m[2]);
                    } else {
                        ret.attrs = WeeChatProtocol._attrsFromStr(m[3]);
                        ret.fgColor = WeeChatProtocol._getColorObj(m[4]);
                    }
                    ret.bgColor = WeeChatProtocol._getColorObj(m[5]);

                    return ret;
                }
            },
            {
                // foreground color with * (+ attributes) (fall back, must be checked before previous case)
                //   "*" + (A)STD
                //   "*" + (A)EXT
                regex: /^\*([\x01\x02\x03\x04*!\/_|]*)(\d{2}|@\d{5})/,
                fn: function(m) {
                    return {
                        fgColor: WeeChatProtocol._getColorObj(m[2]),
                        bgColor: null,
                        attrs: WeeChatProtocol._attrsFromStr(m[1])
                    };
                }
            },
            {
                // emphasis
                //   "E"
                regex: /^E/,
                fn: function(m) {
                    var ret = {};

                    ret.fgColor = {
                        type: 'option',
                        name: 'emphasis'
                    };
                    ret.bgColor = WeeChatProtocol._cloneColor(ret.fgColor);
                    ret.attrs = {
                        name: 'emphasis',
                        override: {}
                    };

                    return ret;
                }
            }
        ];

        // parse
        var ret = {
            fgColor: null,
            bgColor: null,
            attrs: null,
            text: txt
        };
        matchers.some(function(matcher) {
            var m = txt.match(matcher.regex);
            if (m) {
                ret = matcher.fn(m);
                ret.text = txt.substring(m[0].length);
                return true;
            }

            return false;
        });

        return ret;
    };

    /**
     * Transforms a raw text into an array of text elements with integrated
     * colors and attributes.
     *
     * @param rawText Raw text to transform
     * @return Array of text elements
     */
    WeeChatProtocol.rawText2Rich = function(rawText) {
        /* This is subtle, but JavaScript adds the token to the output list
         * when it's surrounded by capturing parentheses.
         */
        var parts = rawText.split(/(\x19|\x1a|\x1b|\x1c)/);

        // no colors/attributes
        if (parts.length === 1) {
            return [
                {
                    attrs: WeeChatProtocol._getDefaultAttributes(),
                    fgColor: WeeChatProtocol._getDefaultColor(),
                    bgColor: WeeChatProtocol._getDefaultColor(),
                    text: parts[0]
                }
            ];
        }

        // find the style of every part
        var curFgColor = WeeChatProtocol._getDefaultColor();
        var curBgColor = WeeChatProtocol._getDefaultColor();
        var curAttrs = WeeChatProtocol._getDefaultAttributes();
        var curSpecialToken = null;
        var curAttrsOnlyFalseOverrides = true;

        return parts.map(function(p) {
            if (p.length === 0) {
                return null;
            }
            var firstCharCode = p.charCodeAt(0);
            var firstChar = p.charAt(0);

            if (firstCharCode >= 0x19 && firstCharCode <= 0x1c) {
                // special token
                if (firstCharCode === 0x1c) {
                    // always reset colors
                    curFgColor = WeeChatProtocol._getDefaultColor();
                    curBgColor = WeeChatProtocol._getDefaultColor();
                    if (curSpecialToken !== 0x19) {
                        // also reset attributes
                        curAttrs = WeeChatProtocol._getDefaultAttributes();
                    }
                }
                curSpecialToken = firstCharCode;
                return null;
            }

            var text = p;
            if (curSpecialToken === 0x19) {
                // get new style
                var style = WeeChatProtocol._getStyle(p);

                // set foreground color if changed
                if (style.fgColor !== null) {
                    curFgColor = style.fgColor;
                }

                // set background color if changed
                if (style.bgColor !== null) {
                    curBgColor = style.bgColor;
                }

                // set attibutes if changed
                if (style.attrs !== null) {
                    curAttrs = style.attrs;
                }

                // set plain text
                text = style.text;
            } else if (curSpecialToken === 0x1a || curSpecialToken === 0x1b) {
                // set/reset attribute
                var orideVal = (curSpecialToken === 0x1a);

                // set attribute override if we don't have to keep all of them
                if (firstChar !== '|') {
                    var orideName = WeeChatProtocol._attrNameFromChar(firstChar);
                    if (orideName) {
                        // known attribute
                        curAttrs.override[orideName] = orideVal;
                        text = p.substring(1);
                    }
                }
            }

            // reset current special token
            curSpecialToken = null;

            // if text is empty, don't bother returning it
            if (text.length === 0) {
                return null;
            }

            /* As long as attributes are only false overrides, without any option
             * name, it's safe to remove them.
             */
            if (curAttrsOnlyFalseOverrides && curAttrs.name === null) {
                var allReset = true;
                for (var attr in curAttrs.override) {
                    if (curAttrs.override[attr]) {
                        allReset = false;
                        break;
                    }
                }
                if (allReset) {
                    curAttrs.override = {};
                } else {
                    curAttrsOnlyFalseOverrides = false;
                }
            }

            // parsed text element
            return {
                fgColor: WeeChatProtocol._cloneColor(curFgColor),
                bgColor: WeeChatProtocol._cloneColor(curBgColor),
                attrs: WeeChatProtocol._cloneAttrs(curAttrs),
                text: text
            };
        }).filter(function(p) {
            return p !== null;
        });
    };

    /**
     * Unsigned integer array to string.
     *
     * @param uia Unsigned integer array
     * @return Decoded string
     */
    WeeChatProtocol._uia2s = function(uia) {
        if(!uia.length || uia[0] === 0) return "";

        try {
            var encodedString = String.fromCharCode.apply(null, uia),
                decodedString = decodeURIComponent(escape(encodedString));
            return decodedString;
        } catch (exception) {
            // Replace all non-ASCII bytes with "?" if the string couldn't be
            // decoded as UTF-8.
            var s = "";
            for (var i = 0, n = uia.length; i < n; i++) {
                s += uia[i] < 0x80 ? String.fromCharCode(uia[i]) : "?";
            }
            return s;
        }
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

        cmd.replace(/[\r\n]+$/g, "").split("\n");

        return cmd;
    };

    /**
     * Formats an init command.
     *
     * @param params Parameters:
     *            password: password (optional)
     *            compression: compression ('off' or 'zlib') (optional)
     * @return Formatted init command string
     */
    WeeChatProtocol.formatInit = function(params) {
        var defaultParams = {
            password: null,
            compression: 'zlib'
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
     *            id: command ID (optional)
     *            path: hdata path (mandatory)
     *            keys: array of keys (optional)
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
     *            id: command ID (optional)
     *            name: info name (mandatory)
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
     * Formats an infolist command.
     *
     * @param params Parameters:
     *            id: command ID (optional)
     *            name: infolist name (mandatory)
     *            pointer: optional
     *            arguments: optional
     * @return Formatted infolist command string
     */
    WeeChatProtocol.formatInfolist = function(params) {
        var defaultParams = {
            id: null,
            pointer: null,
            args: null

        };
        var parts = [];

        params = WeeChatProtocol._mergeParams(defaultParams, params);
        parts.push(params.name);
        if (params.pointer !== null) {
            parts.push(params.pointer);
        }
        if (params.pointer !== null) {
            parts.push(params.args);
        }

        return WeeChatProtocol._formatCmd(params.id, 'infolist', parts);
    };

    /**
     * Formats a nicklist command.
     *
     * @param params Parameters:
     *            id: command ID (optional)
     *            buffer: buffer name (optional)
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
     *            id: command ID (optional)
     *            buffer: target buffer (mandatory)
     *            data: input data (mandatory)
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
     *            id: command ID (optional)
     *            buffers: array of buffers to sync (optional)
     *            options: array of options (optional)
     * @return Formatted sync command string
     */
    WeeChatProtocol.formatSync = function(params) {
        return WeeChatProtocol._formatSyncDesync('sync', params);
    };

    /**
     * Formats a desync command.
     *
     * @param params Parameters:
     *            id: command ID (optional)
     *            buffers: array of buffers to desync (optional)
     *            options: array of options (optional)
     * @return Formatted desync command string
     */
    WeeChatProtocol.formatDesync = function(params) {
        return WeeChatProtocol._formatSyncDesync('desync', params);
    };

    /**
     * Formats a test command.
     *
     * @param params Parameters:
     *            id: command ID (optional)
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
     *            id: command ID (optional)
     *            args: array of custom arguments (optional)
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

            var keys = this._getString().split(',');
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
                compression: comp
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
                    content: self._runType(type)
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
         * Reads an infolist object from the current set of data
         *
         * @return Array
         */
        _getInfolist: function() {
            var self = this;
            var name;
            var count;
            var values;

            name = this._getString();
            count = this._getInt();
            values = [];

            for (var i = 0; i < count; i++) {
                var itemcount = self._getInt();
                var litem = [];
                for (var j = 0; j < itemcount; j++) {
                    var item = {};
                    item[self._getString()] = self._runType(self._getType());
                    litem.push(item);
                }
                values.push(litem);
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
         * Add the ID to the previously formatted command
         *
         * @param id Command ID
         * @param command previously formatted command
         */
        setId: function(id, command) {
            return '(' + id + ') ' + command;
        },

        /**
         * Parses a WeeChat message.
         *
         * @param data Message data (ArrayBuffer)
         * @return Message value
         */
        parse: function(data, optionsValues) {
            var self = this;

            this._setData(data);
            this._dataAt = 0;

            var header = this._getHeader();

            if (header.compression) {
                var raw = new Uint8Array(data, 5);  // skip first five bytes (header, 4B size, 1B compression flag)
                var inflate = new Zlib.Inflate(raw);
                var plain = inflate.decompress();
                this._setData(plain.buffer);
                this._dataAt = 0;  // reset position in data, as the header is not part of the decompressed data
            }

            var id = this._getId();
            var objects = [];
            var object = this._getObject();

            while (object) {
                objects.push(object);
                object = self._getObject();
            }
            var msg = {
                header: header,
                id: id,
                objects: objects
            };

            return msg;
        }
    };

    exports.Protocol = WeeChatProtocol;
})();
})(typeof exports === "undefined" ? this.weeChat = {} : exports);
