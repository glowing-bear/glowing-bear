A web client for WeeChat [![Build Status](https://api.travis-ci.org/glowing-bear/glowing-bear.png)](https://travis-ci.org/glowing-bear/glowing-bear)
========================

Glowing Bear is a HTML5 web frontend for WeeChat that strives to be a modern and slick interface on top of WeeChat. It relies on WeeChat to do all the heavy lifting (connection, servers, history, etc) and then provides a few features on top of that, like content embedding (images, video) and desktop notification. 

Glowing Bear uses WeeChat as directly as the backend. This HTML5 frontend uses WeeChat's relay plugin that allows us to directly connect from the browser to WeeChat using Websockets. This means that the client does not need a special "backend service", as all that is provided by the IRC client itself and this front end consists only of HTML/CSS/JavaScript.

You can run Gloing Bear in multiple ways, just like any old webpage, Firefox app, Chrome app, Chrome app on android (Add to homescreen), and also we provide an Android .APK package available in the Android market.


Get started
==

Required WeeChat version: 0.4.2

To use the web interface you first need to set a relay and a password:

	/relay add weechat 9001
	/set relay.network.password YOURPASSWORD

Then go to the GitHub hosted version of [Glowing Bear](http://glowing-bear.github.io/glowing-bear) !


Screenshots
----------
Running as Chrome application in a separate window on Windows:

![Glowing bear screenshot](http://hveem.no/ss/weechat-web-client720.png)

Running as Firefox application on Android:

![Glowing bear android screenshot](http://hveem.no/ss/weechat-web-android720.png)



Hosting Glowing Bear yourself
=

If you want to host the HTML application yourself it is enough to clone it and serve the pages with a webserver. As an example, this is how to host it using the python simple web server:

    git clone https://github.com/glowing-bear/glowing-bear
    cd glowing-bear
    python -m SimpleHTTPServer


----

Interested in contributing or simply want to talk about the project? Join us on **#glowing-bear** on **freenode**!
