"use strict";
/**
 * Portable utilities for IRC.
 */

var IrcUtils = {
    /**
     * Get a new version of a nick list, sorted alphabetically by lowercase nick.
     *
     * @param nickList Original nick list
     * @return Nick list sorted alphabetically by lowercase nick
     */
    _ciSearchNickList: function(nickList) {
        var newList = [];

        nickList.forEach(function(nick) {
            newList.push(nick);
        });
        newList.sort(function(a, b) {
            return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
        });

        return newList;
    },

    /**
     * Completes a single nick.
     *
     * @param candidate What to search for
     * @param nickList Array of current nicks sorted for case insensitive searching
     * @return Completed nick (null if not found)
     */
    _completeSingleNick: function(candidate, nickList) {
        var foundNick = null;

        nickList.some(function(nick) {
            if (nick.toLowerCase().search(candidate.toLowerCase()) === 0) {
                // found!
                foundNick = nick;
                return true;
            }
            return false;
        });

        return foundNick;
    },

    /**
     * Get the next nick when iterating nicks.
     *
     * @param iterCandidate First characters to look at
     * @param currentNick Current selected nick
     * @param nickList Array of current nicks sorted for case insensitive searching
     * @return Next nick (may be the same)
     */
    _nextNick: function(iterCandidate, currentNick, nickList) {
        var matchingNicks = [];
        var at = null;
        var lcIterCandidate = iterCandidate.toLowerCase();
        var lcCurrentNick = currentNick.toLowerCase();

        // collect matching nicks
        for (var i = 0; i < nickList.length; ++i) {
            var lcNick = nickList[i].toLowerCase();
            if (lcNick.search(lcIterCandidate) === 0) {
                matchingNicks.push(nickList[i]);
                if (lcCurrentNick === lcNick) {
                    at = matchingNicks.length - 1;
                }
            } else if (matchingNicks.length > 0) {
                // end of group, no need to check after this
                break;
            }
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
    },

    /**
     * Nicks tab completion.
     *
     * @param text Plain text (no colors)
     * @param caretPos Current caret position (0 means before the first character)
     * @param iterCandidate Current iteration candidate (null if not iterating)
     * @param nickList Array of current nicks
     * @param suf Custom suffix (at least one character, escaped for regex)
     * @return Object with following properties:
     *      text: new complete replacement text
     *      caretPos: new caret position within new text
     *      foundNick: completed nick (or null if not possible)
     *      iterCandidate: current iterating candidate
     */
    completeNick: function(text, caretPos, iterCandidate, nickList, suf) {
        var doIterate = (iterCandidate !== null);
        if (suf === null) {
            suf = ':';
        }

        // new nick list to search in
        var searchNickList = IrcUtils._ciSearchNickList(nickList);

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
                newNick = IrcUtils._nextNick(iterCandidate, m[1], searchNickList);
                beforeCaret = newNick + suf + ' ';
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
            newNick = IrcUtils._completeSingleNick(m[1], searchNickList);
            if (newNick === null) {
                // no match
                return ret;
            }
            beforeCaret = newNick + suf + ' ';
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
                newNick = IrcUtils._nextNick(iterCandidate, m[2], searchNickList);
                beforeCaret = m[1] + newNick + ' ';
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
            newNick = IrcUtils._completeSingleNick(m[2], searchNickList);
            if (newNick === null) {
                // no match
                return ret;
            }
            beforeCaret = m[1] + newNick + ' ';
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
    }
};
