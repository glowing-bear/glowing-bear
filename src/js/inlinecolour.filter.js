
'use strict';

export function inlinecolourFilter() {
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
}