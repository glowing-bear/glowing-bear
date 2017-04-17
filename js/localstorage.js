(function() {
'use strict';

var ls = angular.module('localStorage',[]);

ls.factory("$store", ["$parse", function($parse){
    /**
     * Global Vars
     */
    var storage = (typeof window.localStorage === 'undefined') ? undefined : window.localStorage,
        supported = !(typeof storage == 'undefined' || typeof window.JSON == 'undefined');

    // Safari reports a localStorage object in incognito mode, but trying
    // to use it raises an exception. Catch that case.
    try {
        storage.setItem('dummy', 'dummy');
        storage.removeItem('dummy');
    } catch (error) {
        supported = false;
    }

    if (!supported) {
        console.log('Warning: localStorage is not supported');

        // Set localstorage to a temporary dummy
        storage = (function() {
            var data = {};

            this.setItem = function (key, value) {
                data[key] = value;
            };

            this.getItem = function (key) {
                if (typeof data[key] !== "undefined" ) {
                    return data[key];
                } else {
                    return null;
                }
            };

            this.removeItem = function (key) {
                data[key] = undefined;
            };

            this.length = function() {
                return Object.keys(data).length;
            };

            this.key = function(index) {
                return Object.keys(data)[index];
            };
        })();
    }

    var privateMethods = {
        /**
         * Pass any type of a string from the localStorage to be parsed so it returns a usable version (like an Object)
         * @param res - a string that will be parsed for type
         * @returns {*} - whatever the real type of stored value was
         */
        parseValue: function(res) {
            var val;
            try {
                val = JSON.parse(res);
                if (val === undefined){
                    val = res;
                }
                if (val === 'true'){
                    val = true;
                }
                if (val === 'false'){
                    val = false;
                }
                if (parseFloat(val) == val && !angular.isObject(val)) {
                    val = parseFloat(val);
                }
            } catch(e){
                val = res;
            }
            return val;
        }
    };
    var publicMethods = {
        /**
         * Set - lets you set a new localStorage key pair set
         * @param key - a string that will be used as the accessor for the pair
         * @param value - the value of the localStorage item
         * @returns {*} - will return whatever it is you've stored in the local storage
         */
        set: function(key,value){
            if (!supported){
                console.log('Local Storage not supported');
            }
            var saver = JSON.stringify(value);
            storage.setItem(key, saver);
            return privateMethods.parseValue(saver);
        },
        /**
         * Get - lets you get the value of any pair you've stored
         * @param key - the string that you set as accessor for the pair
         * @returns {*} - Object,String,Float,Boolean depending on what you stored
         */
        get: function(key){
            if (!supported){
                return null;
            }
            var item = storage.getItem(key);
            return privateMethods.parseValue(item);
        },
        /**
         * Remove - lets you nuke a value from localStorage
         * @param key - the accessor value
         * @returns {boolean} - if everything went as planned
         */
        remove: function(key) {
            if (!supported){
                return false;
            }
            storage.removeItem(key);
            return true;
        },
        /**
          * Enumerate all keys
          */
        enumerateKeys: function() {
            var keys = [];
            for (var i = 0, len = storage.length; i < len; ++i) {
                keys.push(storage.key(i));
            }
            return keys;
        },
        /**
         * Bind - lets you directly bind a localStorage value to a $scope variable
         * @param $scope - the current scope you want the variable available in
         * @param key - the name of the variable you are binding
         * @param def - the default value (OPTIONAL)
         * @returns {*} - returns whatever the stored value is
         */
        bind: function ($scope, key, def) {
            if (def === undefined) {
                def = '';
            }
            if (publicMethods.get(key) === undefined || publicMethods.get(key) === null) {
                publicMethods.set(key, def);
            }
            $parse(key).assign($scope, publicMethods.get(key));
            $scope.$watch(key, function (val) {
                publicMethods.set(key, val);
            }, true);
            return publicMethods.get(key);
        }
    };
    return publicMethods;
}]);
})();
