'use strict';

import * as _ from "underscore";

var weechat = angular.module('weechat');

// Calls the 'linky' filter unless the disable flag is set. Useful for things like join/quit messages,
// so you don't accidentally click a mailto: on someone's hostmask.
weechat.filter('conditionalLinkify', ['$filter', function($filter) {
    return function(text, disable) {
        if (!text || disable) {
            return text;
        }

        return linkifyStr(text, {
            className: '',
            attributes: {
                rel: 'noopener noreferrer'
            },
            target: {
                url: '_blank'
            },
            validate: {
                email: function () {
                    return false; //Do not linkify emails
                }
            }
          });
    };
}]);

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
                // Don't update jump key upon filtering
                if (obj[ info[2] ].$jumpKey === undefined) {
                    // Only assign jump keys up to 99
                    obj[ info[2] ].$jumpKey = (keyIdx < 99) ? keyIdx + 1 : '';
                }
            });
        }
        return obj;
    };
});
