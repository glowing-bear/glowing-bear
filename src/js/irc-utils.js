/**
 * Portable utilities for IRC.
 */
'use strict';


var IrcUtils = angular.module('IrcUtils', []);

IrcUtils.service('IrcUtils', [function() {
    /**
     * Escape a string for usage in a larger regexp
     * @param str String to escape
     * @return Escaped string
     */
     var escapeRegExp = function(str) {
         return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
     };

    /**
     * Completes a single nick.
     *
     * @param candidate What to search for
     * @param nickList Array of current nicks sorted for case insensitive searching
     * @return Completed nick (null if not found)
     */
    var _completeSingleNick = function(candidate, nickList) {
        var foundNick = null;

        nickList.some(function(nick) {
            if (nick.toLowerCase().indexOf(candidate.toLowerCase()) === 0) {
                // found!
                foundNick = nick;
                return true;
            }
            return false;
        });

        return foundNick;
    };

    /**
     * Get the next nick when iterating nicks.
     *
     * @param iterCandidate First characters to look at
     * @param currentNick Current selected nick
     * @param nickList Array of current nicks sorted for case insensitive searching
     * @return Next nick (may be the same)
     */
    var _nextNick = function(iterCandidate, currentNick, nickList) {
        var matchingNicks = [];
        var at = null;
        var lcIterCandidate = iterCandidate.toLowerCase();
        var lcCurrentNick = currentNick.toLowerCase();

        // collect matching nicks
        for (var i = 0; i < nickList.length; ++i) {
            var lcNick = nickList[i].toLowerCase();
            if (lcNick.indexOf(lcIterCandidate) === 0) {
                matchingNicks.push(nickList[i]);
                if (lcCurrentNick === lcNick) {
                    at = matchingNicks.length - 1;
                }
            }
            /* Since we aren't sorted any more torhve disabled this:
            else if (matchingNicks.length > 0) {
                // end of group, no need to check after this
                //break;
            }
            */
        }

        if (at === null || matchingNicks.length === 0) {
            return currentNick;
        } else {
            ++at;
            if (at === matchingNicks.length) {
                // cycle
                at = 0;
            }
            return matchingNicks[at];
        }
    };

    /**
     * Nicks tab completion.
     *
     * @param text Plain text (no colors)
     * @param caretPos Current caret position (0 means before the first character)
     * @param iterCandidate Current iteration candidate (null if not iterating)
     * @param nickList Array of current nicks
     * @param suf Custom suffix (at least one character, escaped for regex)
     * @param addSpace Whether to add a space after nick completion in the middle
     * @return Object with following properties:
     *      text: new complete replacement text
     *      caretPos: new caret position within new text
     *      foundNick: completed nick (or null if not possible)
     *      iterCandidate: current iterating candidate
     */
    var completeNick = function(text, caretPos, iterCandidate, nickList, suf, addSpace) {
        var doIterate = (iterCandidate !== null);
        if (suf === undefined) {
            suf = ':';
        }
        // addSpace defaults to true
        var addSpaceChar = (addSpace === undefined || addSpace === 'on') ? ' ' : '';

        // new nick list to search in
        var searchNickList = nickList.map((el) => el.name);

        // text before and after caret
        var beforeCaret = text.substring(0, caretPos);
        var afterCaret = text.substring(caretPos);

        // default: don't change anything
        var ret = {
            text: text,
            caretPos: caretPos,
            foundNick: null,
            iterCandidate: null
        };

        // iterating nicks at the beginning?
        var m = beforeCaret.match(new RegExp('^([a-zA-Z0-9_\\\\\\[\\]{}^`|-]+)' + suf + ' $'));

        var newNick = null;
        if (m) {
            if (doIterate) {
                // try iterating
                newNick = _nextNick(iterCandidate, m[1], searchNickList);
                if (suf.endsWith(' ')) {
                    beforeCaret = newNick + suf;
                } else {
                    beforeCaret = newNick + suf + ' ';
                }
                return {
                    text: beforeCaret + afterCaret,
                    caretPos: beforeCaret.length,
                    foundNick: newNick,
                    iterCandidate: iterCandidate
                };
            } else {
                // if not iterating, don't do anything
                return ret;
            }
        }

        // nick completion in the beginning?
        m = beforeCaret.match(/^([a-zA-Z0-9_\\\[\]{}^`|-]+)$/);
        if (m) {
            // try completing
            newNick = _completeSingleNick(m[1], searchNickList);
            if (newNick === null) {
                // no match
                return ret;
            }
            if (suf.endsWith(' ')) {
                beforeCaret = newNick + suf;
            } else {
                beforeCaret = newNick + suf + ' ';
            }
            if (afterCaret[0] === ' ') {
                // swallow first space after caret if any
                afterCaret = afterCaret.substring(1);
            }
            return {
                text: beforeCaret + afterCaret,
                caretPos: beforeCaret.length,
                foundNick: newNick,
                iterCandidate: m[1]
            };
        }

        // iterating nicks in the middle?
        m = beforeCaret.match(/^(.* )([a-zA-Z0-9_\\\[\]{}^`|-]+) $/);
        if (m) {
            if (doIterate) {
                // try iterating
                newNick = _nextNick(iterCandidate, m[2], searchNickList);
                beforeCaret = m[1] + newNick + addSpaceChar;
                return {
                    text: beforeCaret + afterCaret,
                    caretPos: beforeCaret.length,
                    foundNick: newNick,
                    iterCandidate: iterCandidate
                };
            } else {
                // if not iterating, don't do anything
                return ret;
            }
        }

        // nick completion elsewhere in the middle?
        m = beforeCaret.match(/^(.* )([a-zA-Z0-9_\\\[\]{}^`|-]+)$/);
        if (m) {
            // try completing
            newNick = _completeSingleNick(m[2], searchNickList);
            if (newNick === null) {
                // no match
                return ret;
            }
            beforeCaret = m[1] + newNick + addSpaceChar;
            if (afterCaret[0] === ' ') {
                // swallow first space after caret if any
                afterCaret = afterCaret.substring(1);
            }
            return {
                text: beforeCaret + afterCaret,
                caretPos: beforeCaret.length,
                foundNick: newNick,
                iterCandidate: m[2]
            };
        }

        // completion not possible
        return ret;
    };

    return {
        'completeNick': completeNick
    };
}]);
