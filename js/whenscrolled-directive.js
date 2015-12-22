(function() {
'use strict';

var weechat = angular.module('weechat');
weechat.directive('whenScrolled', function() {
    return function(scope, elm, attr) {
        var raw = elm[0];

        var fun = function() {
            if (raw.scrollTop === 0) {
                scope.$apply(attr.whenScrolled);
            }
        };

        elm.bind('scroll', function() {
            _.debounce(fun, 200)();
        });
    };
});

})();
