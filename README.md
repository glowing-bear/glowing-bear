A web client for WeeChat
========================

Required Weechat version: 0.4.2

To use the web interface you first need to set a relay and a password:

	/relay add weechat 9001
	/set relay.network.password YOURPASSWORD

Then you can point your browser to the
[Glowing Bear](http://cormier.github.io/glowing-bear) !

Contributing to glowing-bear
----------------------------

### 1. Setup your environment

We use Bower to manage dependencies:

	$ npm install -r bower
	$ bower install bower.json
	
The files have to be served from a web server. It's as simple as running this command in the glowing-bear directory:

	$ python -m SimpleHTTPServer

For any information don't hesitate and join us on **#glowing-bear** on **freenode**!

