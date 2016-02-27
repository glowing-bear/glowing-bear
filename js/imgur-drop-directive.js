(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.directive('imgurDrop', ['connection','imgur','$rootScope', function(connection, imgur, $rootScope) {
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

                // Send image url after upload
                var sendImageUrl = function(imageUrl) {

                    // Send image
                    if(imageUrl !== undefined && imageUrl !== '') {
                        $rootScope.insertAtCaret(String(imageUrl));
                    }

                };

                // Check files
                if(typeof files !== "undefined" && files.length > 0) {

                    // Loop through files
                    for (var i = 0; i < files.length; i++) {
                        // Upload to imgur
                        imgur.process(files[i], sendImageUrl);
                    }

                }
            };
        }
    };
}]);

})();
