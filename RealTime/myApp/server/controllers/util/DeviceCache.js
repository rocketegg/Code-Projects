// DeviceCache.js
// 
// A cache that contains historical performance information about a device - this is used for
// custom MOS score computation
//    - Each field has a custom ttl so it will periodically refresh from the persistence
// 
// This ends up being an map of devices like so:
//     {
//         "127.0.0.1": {
//             jitter: {},
//             calls: {}, 
//             etc. whatever  
//         }
//         "Another IP": {}
//       }
//     }
//
// Author: Al Ho 6/6/2014
'use strict';
var mongoose = require('mongoose'),
    _ = require('lodash'),
    Cache = require('./Cache.js');

var ttl = 60000;    //1 minute refreshes
var DeviceCache = function (size) {

    if (DeviceCache.prototype._singletonInstance) {
        return DeviceCache.prototype._singletonInstance;
    }

    DeviceCache.prototype._singletonInstance = this;

    //private cache
    var cache = new Cache();
    
    //Public methods

    //Updates device metadata with various searching
    this.updateMetadata = function(key) {

    };

    //Updates device cache with qos values
    this.updateStatistics = function(key, packetArray) {

    };

    this.getStatistics = function(key) {
        return cache.getItem(key);
    };

};

module.exports = DeviceCache;