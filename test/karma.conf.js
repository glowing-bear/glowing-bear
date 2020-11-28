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
      'node_modules/linkifyjs/dist/linkify.js',
      'node_modules/linkifyjs/dist/linkify-string.js',
      'src/js/localstorage.js',
      'src/js/weechat.js',
      'src/js/irc-utils.js',
      'src/js/glowingbear.js',
      'src/js/utils.js',
      'src/js/notifications.js',
      'src/js/filters.js',
      'src/js/handlers.js',
      'src/js/connection.js',
      'src/js/inputbar.js',
      'src/js/plugin-directive.js',
      'src/js/websockets.js',
      'src/js/models.js',
      'src/js/bufferResume.js',
      'src/js/plugins.js',
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
