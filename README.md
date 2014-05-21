A web client for WeeChat [![Build Status](https://api.travis-ci.org/glowing-bear/glowing-bear.png)](https://travis-ci.org/glowing-bear/glowing-bear)
========================

Glowing Bear is a HTML5 web frontend for WeeChat that strives to be a modern and slick interface on top of WeeChat. It relies on WeeChat to do all the heavy lifting (connection, servers, history, etc) and then provides some nice features on top of that, like content embedding (images, video) and desktop notifications. The main advantage, though, is that you can access it from any modern device without having to worry about ssh connections or terminal emulators.

Glowing Bear uses WeeChat directly as the backend through its relay plugin, which allows it to directly connect to WeeChat from the browser using Websockets. That means that the client does not need a special "backend service", and you don't have to install anything. A connection is made from your browser to your WeeChat, with no services in between. Thus, Glowing Bear is written in pure client-side JavaScript with a bit of HTML and CSS.

Getting started
===============

Required WeeChat version: 0.4.2

To use the web interface you first need to set a relay and a password:

	/relay add weechat 9001
	/set relay.network.password YOURPASSWORD

Then go to the GitHub hosted version of [Glowing Bear](http://glowing-bear.github.io/glowing-bear)!

You can run Glowing Bear in multiple ways: use it like any other webpage, as a Firefox or Chrome app, or a full-screen Chrome app on Android ("Add to homescreen"). We also provide an [Android app](https://play.google.com/store/apps/details?id=com.glowing_bear) that you can install from the Google Play Store.

Screenshots
----------
Running as Chrome application in a separate window on Windows:

![Glowing bear screenshot](http://hveem.no/ss/weechat-web-client720.png)

Running as Firefox application on Android:

![Glowing bear android screenshot](http://hveem.no/ss/weechat-web-android720.png)


Development
===========

Getting started with the development of Glowing Bear is really simple, partly because we don't have a build process (pure client-side JS, remember). All you have to do is clone the repository, fire up a webserver to host the files, and start fiddling around. You can try out your changes by reloading the page.

Here's a simple example using the python simple web server:
```bash
git clone https://github.com/glowing-bear/glowing-bear
cd glowing-bear
python -m SimpleHTTPServer
```

Now you can point your browser to [http://localhost:8000](http://localhost:8000)!

Remember that **you don't need to host Glowing Bear yourself to use it**, you can just use the [GitHub hosted version](http://glowing-bear.github.io/glowing-bear), and we'll take care of updates for you. Your browser connects to WeeChat directly, so it does not matter where Glowing Bear is hosted.

If you'd prefer a version hosted with HTTPS, GitHub serves that with a undocumented, not officially supported link that as well. Be careful though, it might break any minute. Don't blame us if it stops working, you've been warned. Anyway, here's the link: [secret GitHub HTTPS link](https://glowing-bear.github.io/glowing-bear/) (the trailing forward slash in the URL seems to make all the difference).

Contributing
------------

Interested in contributing or simply want to talk about the project? Join us at **#glowing-bear** on **freenode**!
