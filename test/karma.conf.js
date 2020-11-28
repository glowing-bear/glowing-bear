const webpackConfig = require('../webpack.config');

module.exports = function (config) {
  config.set({

    basePath: '../',

    files: [
      'node_modules/linkifyjs/dist/linkify.js',
      'node_modules/linkifyjs/dist/linkify-string.js',
      'test/unit/main.test.js'
    ],

    autoWatch: true,

    frameworks: ['jasmine'],

    browsers: ['Chrome', 'ChromeHeadless', 'ChromeHeadlessNoSandbox'],

    singleRun: true,

    plugins: [
      'karma-phantomjs-launcher',
      'karma-jasmine',
      'karma-junit-reporter',
      'karma-webpack'
    ],

    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-setuid-sandbox']
      }
      
    },

    junitReporter: {
      outputFile: 'test_out/unit.xml',
      suite: 'unit'
    },

    /* karma-webpack config
       pass your webpack configuration for karma
       add `babel-loader` to the webpack configuration to make 
       the ES6+ code in the test files readable to the browser  
       eg. import, export keywords */
    webpack: {
      devtool: webpackConfig.devtool,
      module: webpackConfig.module,
      optimization: {
        runtimeChunk: false,
        splitChunks: false
      },
    },
    
    preprocessors: {
      //add webpack as preprocessor to support require() in test-suits .js files
      './test/unit/*.js': ['webpack'],
      './src/**/*.js': ['webpack']
    },
    // webpackMiddleware: {
    //   //turn off webpack bash output when run the tests
    //   noInfo: true,
    //   stats: 'errors-only'
    // }

  });

  if(process.env.TRAVIS){
    config.browsers = ['ChromeHeadlessNoSandbox'];
  }
};
