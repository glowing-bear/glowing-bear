# A web client for WeeChat [![Build Status](https://api.travis-ci.org/glowing-bear/glowing-bear.png)](https://travis-ci.org/glowing-bear/glowing-bear?branch=master)

Glowing Bear is a web frontend for the [WeeChat](https://weechat.org) IRC client and strives to be a modern interface. It relies on WeeChat to do all the heavy lifting and then provides some nice features on top of that, like embedding images, videos, and other content. The best part, however, is that you can use it from any modern internet device -- whether it's a computer, tablet, or smart phone -- and all your stuff is there, wherever you are. You don't have to deal with the messy technical details, and all you need to have installed is a browser or our app.

## Getting Started


Glowing Bear connects to the WeeChat instance you're already running (version 0.4.2 or later is required), and you need to be able to establish a connection to the WeeChat host from your device. It makes use of the relay plugin, and therefore you need to set up a relay. If you want to get started as quickly as possible, use these commands in WeeChat:

	/relay add weechat 9001
	/set relay.network.password YOURPASSWORD

Now point your browser to the [Glowing Bear](http://www.glowing-bear.org)! If you're having trouble connecting, check that the host and port of your WeeChat host are entered correctly, and that your server's firewall permits incoming connections on the relay port.

**Please note that the above instructions set up an unencrypted relay, and all your data will be transmitted in clear.** Therefore, we strongly recommend that you set up encryption if you want to keep using Glowing Bear. We've written [a detailed guide on how to set up a trusted secure relay](https://4z2.de/2014/07/06/weechat-trusted-relay) for you (you should probably use [Let's Encrypt](https://letsencrypt.org/) nowadays—it didn't exist yet when this guide was written)

You can run Glowing Bear in many ways:

 * like any other webpage
 * Chrome app ("Tools", then "Create application shortcuts")
 * Android Chrome app a full-screen experience ("Add to homescreen").
 * [Android app](https://play.google.com/store/apps/details?id=com.glowing_bear) that you can install from the Google Play Store
 * Electron app, for Windows, Linux and MacOSX. ```npm install; npm install electron-packager; npm run build-electron-{windows, darwin, linux}```

<a href="https://play.google.com/store/apps/details?id=com.glowing_bear"><img alt="Android app on Google Play" src="/assets/img/badge_playstore.png" /></a>

## Screenshots

Running as Chrome application in a separate window on Windows and as Android app:

![Glowing bear screenshot](https://4z2.de/glowingbear.png)

Are you good with design? We'd love your help!
![Glowing Bear screenshot with lots of Comic Sans MS](https://4z2.de/glowing-bear3.png)

## How it Works

What follows is a more technical explanation of how Glowing Bear works, and you don't need to understand it to use it.

Glowing Bear uses WeeChat directly as its backend through the relay plugin. This means that we can connect to WeeChat directly from the browser using WebSockets. Therefore, the client does not need a special "backend service", and you don't have to install anything. A connection is made from your browser to your WeeChat, with no services in between. Thus, Glowing Bear is written purely in client-side JavaScript with a bit of HTML and CSS.

## FAQ

- *Can I use Glowing Bear to access a machine or port not exposed to the internet by passing the connection through my server?* No, that's not what Glowing Bear does. You can use a websocket proxy module for your webserver to forward `/weechat` to your WeeChat instance though. Here are some pointers you might find helpful for setting this up with [nginx](http://nginx.com/blog/websocket-nginx/) or [apache](https://httpd.apache.org/docs/2.4/mod/mod_proxy_wstunnel.html).
- *How does the encryption work?* TLS is used for securing the connection if you enable encryption. This is handled by your browser, and we have no influence on certificate handling, etc. You can find more detailed instructions on how to communicate securely in the "encryption instructions" tab on the [landing page](https://www.glowing-bear.org). A detailed guide on setting up a trusted secure relay is available [here](https://4z2.de/2014/07/06/weechat-trusted-relay).
- *Can I make it so that there are no requests to third party servers at all?* Sure, you'll have to hide embeds by default (it's in the settings dialog), and download the JavaScript files for which we use a CDN by default. For the second step, you have two options: a) use the Android or Electron app, or b) run `npm run make-local` to download the files and apply a patch to use them instead of the CDN. But remember to re-run this command whenever you update Glowing Bear!

## Development

### Setup
Getting started with the development of Glowing Bear is really simple, partly because we don't have a build process (pure client-side JS, remember). All you have to do is clone the repository, fire up a webserver to host the files, and start fiddling around. You can try out your changes by reloading the page.

Here's a simple example using the python simple web server:
```bash
git clone https://github.com/glowing-bear/glowing-bear
cd glowing-bear
# python 2.*
python -m SimpleHTTPServer
# or python 3.*
python -m http.server
```

Now you can point your browser to [http://localhost:8000](http://localhost:8000)!

Remember that **you don't need to host Glowing Bear yourself to use it**, you can just use [our hosted version](https://www.glowing-bear.org) powered by GitHub pages, and we'll take care of updates for you. Your browser connects to WeeChat directly, so it does not matter where Glowing Bear is hosted.

You can also use the latest and greatest development version of Glowing Bear at [https://latest.glowing-bear.org/](https://latest.glowing-bear.org/).  Branches of this repository are available as [https://latest.glowing-bear.org/**branchname**/](https://latest.glowing-bear.org/branchname/), and pull requests as [https://latest.glowing-bear.org/pull/**123**/](https://latest.glowing-bear.org/pull/123/)—note the trailing slashes.

### Running the tests
Glowing Bear uses Karma and Jasmine to run its unit tests. To run the tests locally, you will first need to install `npm` on your machine. Check out the wonderful [nvm](https://github.com/creationix/nvm) if you don't know it already, it's highly recommended.

Once this is done, you will need to retrieve the necessary packages for testing Glowing-Bear (first, you might want to use `npm link` on any packages you have already installed globally):

`$ npm install`

Finally, you can run the unit tests:

`$ npm test`

Or the end to end tests:
`$ npm run protractor`

**Note**: the end to end tests assume that a web server is hosting Glowing Bear on `localhost:8000` and that a WeeChat relay is configured on port 9001.

## Contributing

Whether you are interested in contributing or simply want to talk about the project, join us at **#glowing-bear** on **freenode**!

We appreciate all forms of contributions -- whether you're a coder, designer, or user, we are always curious what you have to say. Whether you have suggestions or already implemented a solution, let us know and we'll try to help. We're also very keen to hear which devices and platforms Glowing Bear works on (or doesn't), as we're a small team and don't have access to the resources we would need to test it everywhere.

If you wish to submit code, we try to make the contribution process as simple as possible. Any pull request that is submitted has to go through automatic and manual testing. Please make sure that your changes pass the [Travis](https://travis-ci.org/glowing-bear/glowing-bear) tests before submitting a pull request. Here is how you can run the tests:

`$ ./run_tests.sh`

 We'd also like to ask you to join our IRC channel, #glowing-bear on freenode, so we can discuss your ideas and changes.

If you're curious about the projects we're using, here's a list: [AngularJS](https://angularjs.org/), [Bootstrap](http://getbootstrap.com/), [Underscore](http://underscorejs.org/), [favico.js](http://lab.ejci.net/favico.js/), Emoji provided free by [Emoji One](http://emojione.com/), and [zlib.js](https://github.com/imaya/zlib.js). Technology-wise, [WebSockets](https://en.wikipedia.org/wiki/WebSocket) are the most important part, but we also use [local storage](https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage#localStorage), the [Notification Web API](https://developer.mozilla.org/en/docs/Web/API/notification), and last (but not least) [Apache Cordova](https://cordova.apache.org/) for our mobile app.
