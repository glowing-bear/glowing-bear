
'use strict';

export function codifyFilter() {
    return function(text) {
        // The groups of this regex are:
        // 1. Start of line or space, to prevent codifying weird`stuff` like this
        // 2. Opening single or triple backticks (not 2, not more than 3)
        // 3. The code block, does not start with another backtick, non-greedy expansion
        // 4. The closing backticks, identical to group 2
        var re = /(^|\s)(```|`)([^`].*?)\2/g;
        return text.replace(re, function(match, ws, open, code) {
            var rr = ws + '<span class="hidden-bracket">' + open + '</span><code>' + code + '</code><span class="hidden-bracket">' + open + '</span>';
            return rr;
        });
    };
}