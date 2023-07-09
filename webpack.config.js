"use strict";

const path = require("path");

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");

require("webpack");
module.exports = {
    context: path.resolve(__dirname, 'src'),
    entry: './main.js',
    mode: 'production',
    performance: {
        maxEntrypointSize: 600000,
        maxAssetSize: 600000
    },
    output: {
        path: path.resolve(__dirname, 'build'),
    },
    devServer: {
        static: {
            directory: path.resolve(__dirname, 'build')
        },
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
                "**/*.mp3",
                "**/*.ogg",
                "**/*.svg",
                "**/*.png",
                "directives/*.html",
                "serviceworker.js",
                "../package.json",
                "manifest.json",
                "manifest.webapp",
                "webapp.manifest.json",
                {
                    from: "../node_modules/bootstrap/dist/css/bootstrap.min.css",
                    to: "css/"
                },
                {
                    from: "../node_modules/bootstrap/dist/fonts/glyphicons-halflings-regular.woff2",
                    to: "fonts/"
                },
                { from: "../node_modules/emojione/lib/js/emojione.min.js" },
                { from: "../node_modules/linkifyjs/dist/linkify.min.js" },
                { from: "../node_modules/linkify-string/dist/linkify-string.min.js" },
            ]
        }),
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
            },
        ]
    }
};
