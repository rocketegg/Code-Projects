//Generic cache from the directory and caches all of them for fast access
//Author: Al Ho 4/25/2014
'use strict';
var mongoose = require('mongoose'),
    _ = require('lodash');

var Cache = function () {
    //private cache
    var cache = {};

    //preps object for delivery
    function serializeObject(value) {
        var newobj;
        return _.extend(value, newobj);
    }

    function getRandomKey() {
        var keys = Object.keys(cache);
        if (!keys || keys.length < 1) {
            return {};
        } else {
            return keys[Math.floor(Math.random() * keys.length)];
        }
    }

    return {
        //Clear cache
        clear: function() {
            cache = {};
        },

        clearItem: function(key) {
            delete cache[key];
        },

        getAll: function() {
            var copy;
            return _.extend(cache, copy);
        },

        getSize: function() {
            return {
                size: Object.keys(cache) ? Object.keys(cache).length : 0
            }
        },
        //Purge up to an hour ago
        getItem: function(key) {
            return serializeObject(cache[key]);
        },

        setItem: function(key, val) {
            cache[key] = val;
        },

        hasKey: function(key) {
            return cache.hasOwnProperty(key);
        },

        getRandomVal: function() {
            var keys = Object.keys(cache);
            if (!keys || keys.length < 1) {
                return {};
            } else {
                return serializeObject(cache[keys[Math.floor(Math.random() * keys.length)]]);
            }
        },

        getRandomKey: function() {
            return getRandomKey();
        }
    };
};

module.exports = Cache;