(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.filter('toArray', function () {
    return function (obj, storeIdx) {
        if (!(obj instanceof Object)) {
            return obj;
        }

        if (storeIdx) {
            return Object.keys(obj).map(function (key, idx) {
                return Object.defineProperties(obj[key], {
                    '$key' : { value: key },
                    '$idx' : { value: idx, configurable: true }
                });
            });
        }

        return Object.keys(obj).map(function (key) {
            return Object.defineProperty(obj[key], '$key', { value: key });
        });
    };
});

weechat.filter('irclinky', function() {
    return function(text) {
        if (!text) {
            return text;
        }

        // This regex in no way matches all IRC channel names (they could also begin with &, + or an
        // exclamation mark followed by 5 alphanumeric characters, and are bounded in length by 50).
        // However, it matches all *common* IRC channels while trying to minimise false positives.
        // "#1" is much more likely to be "number 1" than "IRC channel #1".
        // Thus, we only match channels beginning with a # and having at least one letter in them.
        var channelRegex = /(^|[\s,.:;?!"'()+@-\~%])(#+[^\x00\x07\r\n\s,:]*[a-z][^\x00\x07\r\n\s,:]*)/gmi;
        // Call the method we bound to window.openBuffer when we instantiated
        // the Weechat controller.
        var substitute = '$1<a href="#" onclick="openBuffer(\'$2\');">$2</a>';
        return text.replace(channelRegex, substitute);
    };
});

weechat.filter('inlinecolour', function() {
    return function(text) {
        if (!text) {
            return text;
        }

        // only match 6-digit colour codes, 3-digit ones have too many false positives (issue numbers, etc)
        var hexColourRegex = /(^|[^&])(\#[0-9a-f]{6};?)(?!\w)/gmi;
        var rgbColourRegex = /(.?)(rgba?\((?:\s*\d+\s*,){2}\s*\d+\s*(?:,\s*[\d.]+\s*)?\);?)/gmi;
        var substitute = '$1$2 <div class="colourbox" style="background-color:$2"></div>';
        text = text.replace(hexColourRegex, substitute);
        text = text.replace(rgbColourRegex, substitute);
        return text;
    };
});

// apply a filter to an HTML string's text nodes, and do so with not exceedingly terrible performance
weechat.filter('DOMfilter', ['$filter', '$sce', function($filter, $sce) {
    // To prevent nested anchors, we need to know if a filter is going to create them.
    // Here's a list of names. See #681 for more information.
    var filtersThatCreateAnchors = ['irclinky'];

    return function(text, filter) {
        if (!text || !filter) {
            return text;
        }
        var createsAnchor = filtersThatCreateAnchors.indexOf(filter) > -1;

        var escape_html = function(text) {
            // First, escape entities to prevent escaping issues because it's a bad idea
            // to parse/modify HTML with regexes, which we do a couple of lines down...
            var entities = {"<": "&lt;", ">": "&gt;", '"': '&quot;', "'": '&#39;', "&": "&amp;", "/": '&#x2F;'};
            return text.replace(/[<>"'&\/]/g, function (char) {
                return entities[char];
            });
        };

        // hacky way to pass extra arguments without using .apply, which
        // would require assembling an argument array. PERFORMANCE!!!
        var extraArgument = (arguments.length > 2) ? arguments[2] : null;
        var thirdArgument = (arguments.length > 3) ? arguments[3] : null;

        var filterFunction = $filter(filter);
        var el = document.createElement('div');
        el.innerHTML = text;

        // Recursive DOM-walking function applying the filter to the text nodes
        var process = function(node) {
            if (node.nodeType === 3) { // text node
                // apply the filter to *escaped* HTML, and only commit changes if
                // it changed the escaped value. This is because setting the result
                // as innerHTML causes it to be unescaped.
                var input = escape_html(node.nodeValue);
                var value = filterFunction(input, extraArgument, thirdArgument);

                if (value !== input) {
                    // we changed something. create a new node to replace the current one
                    // we could also only add its children but that would probably incur
                    // more overhead than it would gain us
                    var newNode = document.createElement('span');
                    newNode.innerHTML = value;

                    var parent = node.parentNode;
                    var sibling = node.nextSibling;
                    parent.removeChild(node);
                    if (sibling) {
                        parent.insertBefore(newNode, sibling);
                    } else {
                        parent.appendChild(newNode);
                    }
                    return newNode;
                }
            }
            // recurse
            if (node === undefined || node === null) return;
            node = node.firstChild;
            while (node) {
                var nextNode = null;
                // do not recurse inside links if the filter would create a nested link
                if (!(createsAnchor && node.tagName === 'A')) {
                    nextNode = process(node);
                }
                node = (nextNode ? nextNode : node).nextSibling;
            }
        };

        process(el);

        return $sce.trustAsHtml(el.innerHTML);
    };
}]);

// This is used by the cordova app to change link targets to "window.open(<url>, '_system')"
// so that they're opened in a browser window and don't navigate away from Glowing Bear
weechat.filter('linksForCordova', ['$sce', function($sce) {
    return function(text) {
        // XXX TODO this needs to be improved
        text = text.replace(/<a (rel="[a-z ]+"\s+)?(?:target="_[a-z]+"\s+)?href="([^"]+)"/gi,
                            "<a $1 onClick=\"window.open('$2', '_system')\"");
        return $sce.trustAsHtml(text);
    };
}]);

weechat.filter('getBufferQuickKeys', function () {
    return function (obj, $scope) {
        if (!$scope) { return obj; }
        if (($scope.search !== undefined && $scope.search.length) || $scope.onlyUnread) {
            obj.forEach(function(buf, idx) {
                buf.$quickKey = idx < 10 ? (idx + 1) % 10 : '';
            });
        } else {
            _.map(obj, function(buffer, idx) {
                return [buffer.number, buffer.$idx, idx];
            }).sort(function(left, right) {
                // By default, Array.prototype.sort() sorts alphabetically.
                // Pass an ordering function to sort by first element.
                return left[0] - right[0] || left[1] - right[1];
            }).forEach(function(info, keyIdx) {
                obj[ info[2] ].$quickKey = keyIdx < 10 ? (keyIdx + 1) % 10 : '';
            });
        }
        return obj;
    };
});

// Emojifis the string using https://github.com/Ranks/emojione
weechat.filter('emojify', function() {
    return function(text, enable_JS_Emoji) {
        if (enable_JS_Emoji === true && window.emojione !== undefined) {
            // Emoji live in the D800-DFFF surrogate plane; only bother passing
            // this range to CPU-expensive unicodeToImage();
            var emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
            if (emojiRegex.test(text)) {
                return emojione.unicodeToImage(text);
            } else {
                return(text);
            }
        } else {
            return(text);
        }
    };
});

weechat.filter('latexmath', function() {
    return function(text, selector, enabled) {
        if (!enabled || typeof(katex) === "undefined") {
            return text;
        }
        if (text.indexOf("$$") != -1 || text.indexOf("\\[") != -1 || text.indexOf("\\(") != -1) {
            // contains math -> delayed rendering
            setTimeout(function() {
                var math = document.querySelector(selector);
                renderMathInElement(math, {
                    delimiters: [
                        {left: "$$", right: "$$", display: false},
                        {left: "\\[", right: "\\]", display: true},
                        {left: "\\(", right: "\\)", display: false}
                    ]
                });
            });
        }

        return text;
    };
});

weechat.filter('prefixlimit', function() {
    return function(input, chars) {
        if (isNaN(chars)) return input;
        if (chars <= 0) return '';
        if (input && input.length > chars) {
            input = input.substring(0, chars);
            return input + '+';
        }
        return input;
    };
});

})();
