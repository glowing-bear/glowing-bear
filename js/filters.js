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

weechat.filter('irclinky', ['$filter', function($filter) {
    return function(text) {
        if (!text) {
            return text;
        }

        // This regex in no way matches all IRC channel names (they could also begin with &, + or an
        // exclamation mark followed by 5 alphanumeric characters, and are bounded in length by 50).
        // However, it matches all *common* IRC channels while trying to minimise false positives.
        // "#1" is much more likely to be "number 1" than "IRC channel #1".
        // Thus, we only match channels beginning with a # and having at least one letter in them.
        var channelRegex = /(^|[\s,.:;?!"'()+@-])(#+[^\x00\x07\r\n\s,:]*[a-z][^\x00\x07\r\n\s,:]*)/gmi;
        // This is SUPER nasty, but ng-click does not work inside a filter, as the markup has to be $compiled first, which is not possible in filter afaik.
        // Therefore, get the scope, fire the method, and $apply. Yuck. I sincerely hope someone finds a better way of doing this.
        var substitute = '$1<a href="#" onclick="var $scope = angular.element(event.target).scope(); $scope.openBuffer(\'$2\'); $scope.$apply();">$2</a>';
        return text.replace(channelRegex, substitute);
    };
}]);

weechat.filter('inlinecolour', function() {
    return function(text) {
        if (!text) {
            return text;
        }

        // only match 6-digit colour codes, 3-digit ones have too many false positives (issue numbers, etc)
        var hexColourRegex = /(^|[^&])\#([0-9a-f]{6})($|[^\w'"])/gmi;
        var substitute = '$1#$2 <div class="colourbox" style="background-color:#$2"></div> $3';

        return text.replace(hexColourRegex, substitute);
    };
});

// apply a filter to an HTML string's text nodes, and do so with not exceedingly terrible performance
weechat.filter('DOMfilter', ['$filter', '$sce', function($filter, $sce) {
    return function(text, filter) {
        if (!text || !filter) {
            return text;
        }

        var filterFunction = $filter(filter);
        var el = document.createElement('div');
        el.innerHTML = text;

        // Recursive DOM-walking function applying the filter to the text nodes
        var process = function(node) {
            if (node.nodeType === 3) { // text node
                var value = filterFunction(node.nodeValue);
                if (value !== node.nodeValue) {
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
                }
            }
            // recurse
            node = node.firstChild;
            while (node) {
                process(node);
                node = node.nextSibling;
            }
        };

        process(el);

        return $sce.trustAsHtml(el.innerHTML);
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
            var skipInactiveCount = 0;
            _.map(obj, function(buffer, idx) {
                return [buffer.number, buffer.$idx, idx];
            }).sort(function(left, right) {
                // By default, Array.prototype.sort() sorts alphabetically.
                // Pass an ordering function to sort by first element.
                return left[0] - right[0] || left[1] - right[1];
            }).forEach(function(info, keyIdx) {
                if (obj[ info[2] ].itemActive) {
                    var cv = keyIdx - skipInactiveCount;
                    obj[ info[2] ].$quickKey = cv < 10 ? (cv + 1) % 10 : '';
                } else {
                    obj[ info[2] ].$quickKey = '';
                    skipInactiveCount++;
                }
            });
        }
        return obj;
    };
});

})();
