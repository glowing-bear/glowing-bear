module.exports = function(config){
  config.set({

    basePath : '../',

    files : [
      'bower_components/angular/angular.js',
      'bower_components/angular-route/angular-route.js',
      'bower_components/angular-mocks/angular-mocks.js',
      'bower_components/angular-sanitize/angular-sanitize.js',
      'bower_components/angular-touch/angular-touch.js',
      'bower_components/underscore/underscore.js',
      'js/localstorage.js',
      'js/weechat.js',
      'js/irc-utils.js',
      'js/glowingbear.js',
      'js/utils.js',
      'js/notifications.js',
      'js/filters.js',
      'js/handlers.js',
      'js/connection.js',
      'js/inputbar.js',
      'js/plugin-directive.js',
      'js/websockets.js',
      'js/models.js',
      'js/bufferResume.js',
      'js/plugins.js',
      'test/unit/**/*.js'
    ],

    autoWatch : true,

    frameworks: ['jasmine'],

    browsers : ['PhantomJS'],

    singleRun: true,

    plugins : [
            'karma-phantomjs-launcher',
            'karma-jasmine',
            'karma-junit-reporter'
            ],

    junitReporter : {
      outputFile: 'test_out/unit.xml',
      suite: 'unit'
    }

  });
};
