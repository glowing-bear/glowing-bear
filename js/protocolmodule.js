var weechat = angular.module('weechat');

weechat.factory('protocolModule',[
function(){
    var name = "WeeChat";
    var mod = weeChat.Protocol;
    // Switch protocol if indicated in query string
    (function() {
        window.location.search.substring(1).split('&').forEach(function(f) {
            var segs = f.split('=');
            if (segs[0] === "protocol" && window[segs[1]] !== undefined && window[segs[1]].Protocol !== undefined) {
                mod = window[segs[1]].Protocol;
                name = segs[1];
                return;
            }
        });
    })();
    return {
        name: name,
        mod: mod
    };
}]);

