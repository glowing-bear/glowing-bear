var weechat = angular.module('weechat');

weechat.directive('plugin', ['$rootScope', function($rootScope) {
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

            $scope.plugin.visible = $rootScope.auto_display_embedded_content;

            $scope.hideContent = function() {
                $scope.plugin.visible = false;
            };

            $scope.showContent = function() {
                /*
                 * Shows the plugin content.
                 * displayedContent is bound to the DOM.
                 * Actual plugin content is only fetched when
                 * content is shown.
                 */

                // If the plugin is asynchronous / lazy, execute it now and store
                // the result. This ensures that the callback is executed only once
                if ($scope.plugin.content instanceof Function) {
                    $scope.plugin.content = $scope.plugin.content();
                }
                $scope.displayedContent = $scope.plugin.content;
                $scope.plugin.visible = true;

                // Scroll embed content into view
                var scroll = function() {
                    var embed = document.querySelector(".embed_" + $scope.plugin.$$hashKey);
                    if (embed && embed.scrollIntoViewIfNeeded !== undefined) {
                        embed.scrollIntoViewIfNeeded();
                    }
                };
                setTimeout(scroll, 100);
            };

            if ($scope.plugin.visible) {
                $scope.showContent();
            }
        }]
    };
}]);
