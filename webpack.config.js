
"use strict";

const path = require("path");

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    context: path.resolve(__dirname, 'src'),
    entry: {
        main: {
            import: './main.js',
            dependOn: 'shared',
        },
        main2: {
            import: './main2.js',
            dependOn: 'shared',
        },
        shared: 'lodash',
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].bundle.js',
    },
    optimization: {
        runtimeChunk: 'single',
    },
    devServer: {
        contentBase: path.resolve(__dirname, 'build')
    },
    devtool: 'source-map',
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
            minify: false
        }),
        new CopyWebpackPlugin({
            patterns: [
                "**/*.css",
                "**/*.svg",
                "**/*.png",
                "**/*.mp3",
                "**/*.ogg",
                "directives/*.html",
                "serviceworker.js",
                "electron-*.js",
                "menu.js",
                "tray.js",
                "context-menu.js",
                "../package.json",
                "manifest.json",
                "manifest.webapp",
                "webapp.manifest.json"
            ]
        })
    ],
    module: {
        rules: [
            {
                test: /\.js$/i,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader'
                    }
                ]
            }
        ]
    }
};
