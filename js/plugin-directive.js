(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.directive('plugin', ['$rootScope', 'settings', function($rootScope, settings) {
    /*
     * Plugin directive
     * Shows additional plugin content
     */
    return {
        templateUrl: 'directives/plugin.html',

        scope: {
            plugin: '=data'
        },

        controller: ['$scope', function($scope) {

            $scope.displayedContent = "";

            // Auto-display embedded content only if it isn't NSFW
            $scope.plugin.visible = !settings.noembed && !$scope.plugin.nsfw;

            // user-accessible hash key that is a valid CSS class name
            $scope.plugin.className = "embed_" + $scope.plugin.$$hashKey.replace(':','_');

            $scope.plugin.getElement = function() {
                return document.querySelector("." + $scope.plugin.className);
            };

            $scope.hideContent = function() {
                $scope.plugin.visible = false;
            };

            $scope.showContent = function(automated) {
                /*
                 * Shows the plugin content.
                 * displayedContent is bound to the DOM.
                 * Actual plugin content is only fetched when
                 * content is shown.
                 */

                var embed = $scope.plugin.getElement();

                // If the plugin is asynchronous / lazy, execute it now and let it insert itself
                // TODO store the result between channel switches
                if ($scope.plugin.content instanceof Function){
                    // Don't rerun if the result is already there
                    if (!embed || embed.innerHTML === "") {
                        // if we're autoshowing, the element doesn't exist yet, and we need
                        // to do this async (wrapped in a setTimeout)
                        setTimeout(function() {
                            $scope.plugin.content();
                        });
                    }
                } else {
                    $scope.displayedContent = $scope.plugin.content;
                }
                $scope.plugin.visible = true;

                // Scroll embed content into view
                var scroll;
                if (automated) {
                    var wasBottom = $rootScope.bufferBottom;
                    scroll = function() {
                        $rootScope.updateBufferBottom(wasBottom);
                    };
                } else {
                    scroll = function() {
                        if (embed && embed.scrollIntoViewIfNeeded !== undefined) {
                            embed.scrollIntoViewIfNeeded();
                            $rootScope.updateBufferBottom();
                        }
                    };
                }
                setTimeout(scroll, 500);
            };

            if ($scope.plugin.visible) {
                $scope.showContent(true);
            }
        }]
    };
}]);
})();
