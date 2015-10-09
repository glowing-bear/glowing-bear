(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.directive('imgurDrop', ['connection','imgur', function(connection, imgur) {
    return {
        restrict: 'A',
        link: function($scope, element, attr) {
            var elem = element[0];
            elem.ondragover = function () { this.classList.add('imgur-drop-hover'); return false; };
            elem.ondragend = function () { this.classList.remove('imgur-drop-hover'); return false; };
            elem.ondrop = function(e) {
                // Remove hover class
                this.classList.remove('imgur-drop-hover');

                // Get files
                var files = e.dataTransfer.files;

                // Stop default behaviour
                e.stopPropagation();
                e.preventDefault();

                // Check files length
                if (files.length > 0) {
                    // Sorry only one file
                    var file = files[0];

                    // Upload to imgur
                    imgur.process(file, function(imageUrl) {

                        // Send image
                        if(imageUrl !== undefined && imageUrl !== '') {
                            connection.sendMessage( String(imageUrl) );
                        }

                    });
                }
            };
        }
    };
}]);

})();
