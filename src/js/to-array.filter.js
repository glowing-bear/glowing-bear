
'use strict';

export function toArrayFilter() {
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
}