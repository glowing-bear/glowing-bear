(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('settings', ['$store', '$rootScope', function($store, $rootScope) {
	var that = this;
	this.callbacks = {};

	// Define a property for a setting, retrieving it on read
	// and writing it to localStorage on write
	var defineProperty = function(key) {
		Object.defineProperty(that, key, {
			enumerable: true,
			key: key,
			get: function() {
				return $store.get(key);
			},
			set: function(newVal) {
				$store.set(key, newVal);
				// Call any callbacks
				var callbacks = that.callbacks[key];
				for (var i = 0; callbacks !== undefined && i < callbacks.length; i++) {
					callbacks[i](newVal);
				}
				// Update the page (might be needed)
				setTimeout(function() {
					$rootScope.$apply();
				}, 0);
			}
		});
	};

	// Define properties for all settings
	var keys = $store.enumerateKeys();
	for (var keyIdx in keys) {
		var key = keys[keyIdx];
		defineProperty(key);
	}

	// Add a callback to be called whenever the value is changed
	// It's like a free $watch and used to be called the observer
	// pattern, but I guess that's too old-school for JS kids :>
	this.addCallback = function(key, callback, callNow) {
		if (this.callbacks[key] === undefined) {
			this.callbacks[key] = [callback];
		} else {
			this.callbacks[key].push(callback);
		}
		// call now to emulate $watch behaviour
		setTimeout(function() {
			callback($store.get(key));
		}, 0);
	};

	this.setDefaults = function(defaults) {
		for (var key in defaults) {
			// null means the key isn't set
			if ($store.get(key) === null) {
				// Define property so it will get saved to store
				defineProperty(key);
				// Save to settings module AND to store
				this[key] = defaults[key];
			}
		}
	};

	return this;
}]);

})();
