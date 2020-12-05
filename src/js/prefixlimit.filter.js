
'use strict';

export function prefixlimitFilter() {
    return function(input, chars) {
        if (isNaN(chars)) return input;
        if (chars <= 0) return '';
        if (input && input.length > chars) {
            input = input.substring(0, chars);
            return input + '+';
        }
        return input;
    };
}