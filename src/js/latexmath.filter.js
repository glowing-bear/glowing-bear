
'use strict';

export function latexmathFilter() {
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
}