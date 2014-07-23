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

//Thresholds for backfilling
var threshold = {
  backfillDevice: 60000
};
var DeviceCache = function (size) {

    if (DeviceCache.prototype._singletonInstance) {
        return DeviceCache.prototype._singletonInstance;
    }

    DeviceCache.prototype._singletonInstance = this;

    //private cache
    var cache = new Cache();
    
    //Public methods
    function initializeCache(key) {
        cache.setItem(key, {
            statistics: {
                lastUpdate: new Date().getTime(),
            },
            metadata: {
                lastUpdate: new Date().getTime(),
                lastBackfill: 0
            }
        });
    }

    //Updates device metadata with SDES packet if available and if necessary
    //metadataPacket is RTCP packet type 202
    this.updateMetadata = function(key, metadataPacket) {
        var needToBackfill = false;//deviceCache.checkBackfill(rinfo.address);
        if (!cache.hasKey(key)) {
            initializeCache(key);
        } 
        var _device = cache.getItem(key);
        var _timeSinceLastUpdate = new Date().getTime() - _device.metadata.lastBackfill;
        needToBackfill = _timeSinceLastUpdate > threshold.backfillDevice;
        console.log('[DEVICE CACHE]: Key: %s.  Time since last update: %d.  Need to backfill: ', key, _timeSinceLastUpdate, needToBackfill);
          
        if (needToBackfill && metadataPacket) {
            var Device = mongoose.model('Device');
            Device.backfillDevice({'metadata.IP_ADDRESS': key},
                metadataPacket, function(err, device) {
                    if (err) console.log(err);  //error backfilling device
                    else {
                        console.log('[DEVICE CACHE]: Device successfully backfilled: ' + key);
                        _device.metadata.lastBackfill = _device.metadata.lastUpdate = new Date().getTime();
                        cache.setItem(key, _device);
                    }
            });
        }
    };

    //Updates device cache with qos values
    this.updateStatistics = function(key, packetArray) {

    };

    this.getStatistics = function(key) {
        return cache.getItem(key);
    };

};

module.exports = DeviceCache;