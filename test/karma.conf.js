module.exports = function(config){
  config.set({

    basePath : '../',

    files : [
      'node_modules/angular/angular.js',
      'node_modules/angular-route/angular-route.js',
      'node_modules/angular-mocks/angular-mocks.js',
      'node_modules/angular-sanitize/angular-sanitize.js',
      'node_modules/angular-touch/angular-touch.js',
      'node_modules/underscore/underscore.js',
      'node_modules/babel-polyfill/dist/polyfill.js',
      'node_modules/autolinker/dist/Autolinker.js',
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
