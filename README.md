A web client for WeeChat [![Build Status](https://api.travis-ci.org/glowing-bear/glowing-bear.png)](https://travis-ci.org/glowing-bear/glowing-bear?branch=master)
========================

**This branch is for use with Apache Cordova, see https://github.com/glowing-bear/glowing-bear-cordova**

Glowing Bear is an HTML5 web frontend for [WeeChat](http://weechat.org) that strives to be a modern and slick interface. It relies on WeeChat to do all the heavy lifting (connections, servers, history, etc) and then provides some nice features on top of that, like content embedding (images, video) and desktop notifications. The main advantage, though, is that you can access it from any modern internet device without having to worry about ssh connections or terminal emulators.

Glowing Bear uses WeeChat directly as the backend through its relay plugin, which allows it to directly connect to WeeChat from the browser using Websockets. That means that the client does not need a special "backend service", and you don't have to install anything. A connection is made from your browser to your WeeChat, with no services in between. Thus, Glowing Bear is written purely in client-side JavaScript with a bit of HTML and CSS.

Getting started
---------------

Required WeeChat version: 0.4.2

To use the web interface you first need to set a relay and a password:

	/relay add weechat 9001
	/set relay.network.password YOURPASSWORD

Then go to our hosted version of [Glowing Bear](http://www.glowing-bear.org)!

You can run Glowing Bear in multiple ways: use it like any other webpage, as a Firefox or Chrome app, or a full-screen Chrome app on Android ("Add to homescreen"). We also provide an [Android app](https://play.google.com/store/apps/details?id=com.glowing_bear) that you can install from the Google Play Store.

Screenshots
-----------
Running as Chrome application in a separate window on Windows and as Android app:

![Glowing bear screenshot](https://4z2.de/glowingbear.png)

FAQ
---

- *Can I use Glowing Bear to access a machine or port not exposed to the internet by passing the connection through my server?* No, that's not what Glowing Bear does. You can use a websocket proxy module for your webserver to forward `/weechat` to your WeeChat instance though. Here are some pointers you might find helpful for setting this up with [nginx](http://nginx.com/blog/websocket-nginx/) or [apache](https://httpd.apache.org/docs/2.4/mod/mod_proxy_wstunnel.html).
- *How does the encryption work?* TLS is used for securing the connection if you enable encryption. You can find more detailed instructions on how to communicate securely in the "encryption instructions" tab on the [landing page](http://www.glowing-bear.org). Note that your browser will perform the certificate validation, so it is strongly recommended to use a certificate that your browser trusts.

Development
-----------

Getting started with the development of Glowing Bear is really simple, partly because we don't have a build process (pure client-side JS, remember). All you have to do is clone the repository, fire up a webserver to host the files, and start fiddling around. You can try out your changes by reloading the page.

Here's a simple example using the python simple web server:
```bash
git clone https://github.com/glowing-bear/glowing-bear
cd glowing-bear
python -m SimpleHTTPServer
```

Now you can point your browser to [http://localhost:8000](http://localhost:8000)!

Remember that **you don't need to host Glowing Bear yourself to use it**, you can just use [our hosted version](http://www.glowing-bear.org) powered by GitHub pages, and we'll take care of updates for you. Your browser connects to WeeChat directly, so it does not matter where Glowing Bear is hosted.

If you'd prefer a version hosted with HTTPS, GitHub serves that as well with an undocumented, not officially supported (by GitHub) link. Be careful though, it might break any minute. Anyway, here's the link: [secret GitHub HTTPS link](https://glowing-bear.github.io/glowing-bear/) (the trailing forward slash in the URL seems to make all the difference).

Contributing
------------

Interested in contributing or simply want to talk about the project? Join us at **#glowing-bear** on **freenode**!

If you're curious about the projects we're using, here's a list: [AngularJS](https://angularjs.org/), [Bootstrap](http://getbootstrap.com/), [bindonce](https://github.com/Pasvaz/bindonce), [Underscore](http://underscorejs.org/), [favico.js](http://lab.ejci.net/favico.js/), and [zlib.js](https://github.com/imaya/zlib.js). Technology-wise, [WebSockets](http://en.wikipedia.org/wiki/WebSocket) are the most important part, but we also use [local storage](https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage#localStorage), the [Notification Web API](https://developer.mozilla.org/en/docs/Web/API/notification), and last (but not least) [Apache Cordova](https://cordova.apache.org/) for our slick app.

We always appreciate pull requests, and if you don't know where to get started, why not browse our [issue tracker](https://github.com/glowing-bear/glowing-bear/issues)? We're also always happy to hear which devices and platforms Glowing Bear works on (or doesn't) — for example, none of our current developers own an Apple device, so if you're interested in helping us test, we'd be most grateful!
