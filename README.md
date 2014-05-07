A web client for WeeChat [![Build Status](https://api.travis-ci.org/glowing-bear/glowing-bear.png)](https://travis-ci.org/glowing-bear/glowing-bear)
========================

Glowing Bear is a HTML5 web frontend for WeeChat that strives to be a modern and slick interface on top of WeeChat. It relies on WeeChat to do all the heavy lifting (connection, servers, history, etc) and then provides a few features on top of that, like content embedding (images, video) and desktop notification. 

Glowing Bear uses WeeChat directly as the backend through its relay plugin, which allows us to directly connect to WeeChat from the browser using Websockets. That means that the client does not need a special "backend service", everything is provided by the IRC client itself and this frontend is written in pure HTML/CSS/JavaScript.

You can run Glowing Bear in multiple ways: use it like any other webpage, as a Firefox or Chrome app, a full-screen Chrome app on Android ("Add to homescreen"), and we also provide an Android app that you can install from the Google Play Store.


Getting started
===============

Required WeeChat version: 0.4.2

To use the web interface you first need to set a relay and a password:

	/relay add weechat 9001
	/set relay.network.password YOURPASSWORD

Then go to the GitHub hosted version of [Glowing Bear](http://glowing-bear.github.io/glowing-bear)!


Screenshots
----------
Running as Chrome application in a separate window on Windows:

![Glowing bear screenshot](http://hveem.no/ss/weechat-web-client720.png)

Running as Firefox application on Android:

![Glowing bear android screenshot](http://hveem.no/ss/weechat-web-android720.png)



Hosting Glowing Bear yourself
=============================

If you want to host the HTML application yourself, it is enough to clone it and serve the pages with a webserver. Here's a simple example using the python simple web server:

    git clone https://github.com/glowing-bear/glowing-bear
    cd glowing-bear
    python -m SimpleHTTPServer

Now you can point your browser to [http://localhost:8000](http://localhost:8000)!

----

Interested in contributing or simply want to talk about the project? Join us at **#glowing-bear** on **freenode**!
