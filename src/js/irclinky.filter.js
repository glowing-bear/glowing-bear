
'use strict';

export function irclinkyFilter() {
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
}