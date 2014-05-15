// DecoderCache.js
// 
// A specific buffer cache that contains (for each ip) the last 12 (or size) udp messages received and decoded packets
// Just a wrapper class for cache, implements singleton
// 
// This ends up being an array of arrays like so:
//     {
//         "127.0.0.1": [
//           [
//             {
//                 mongoPacket1,   //these all share same timestamp
//             }, {
//                 mongoPacket2
//             }
//           ],
//           [                     //these are the next incoming compound packet from the same ip
//           ],
//         ],
//         "Another IP": [
//         ]
//       }
//     }
//
// Author: Al Ho 5/14/2014
'use strict';
var mongoose = require('mongoose'),
    _ = require('lodash'),
    Cache = require('./Cache.js');

var DecoderCache = function (size) {

    if (DecoderCache.prototype._singletonInstance) {
        return DecoderCache.prototype._singletonInstance;
    }

    DecoderCache.prototype._singletonInstance = this;

    //private cache
    var cache = new Cache();
    var bufferSize = size ? size : 12;  //approximately 1 minute worth of data
    console.log("[DECODER CACHE] Initializing cache with buffer size %d", bufferSize);

    this.pushPackets = function(key, value) {
        if (!cache.hasKey(key)) {
            console.log("[DECODER CACHE] Initializing new buffer for key %s", key);
            var packetArray = [];
            packetArray.push(value);
            cache.setItem(key, packetArray);
        } else {
            console.log("[DECODER CACHE] Buffer exists already for key %s, updating.", key);
            var packetArray = cache.getItem(key);
            if (packetArray.length + 1 > bufferSize) {
                console.log("[DECODER CACHE] Buffer full for key %s, splicing.", key);
                packetArray.splice(0,1);
            }
            packetArray.push(value);
            cache.setItem(key, packetArray);
        }
    };

    this.getPackets = function(key) {
        return cache.getItem(key);
    };

    //for a key, returns an array of packet arrays (decoded) that has a packet type and subtype packet in the udp message
    this.filterByType = function(key, packetType, subType) {
        if (!cache.hasKey(key)) {
            console.log("[DECODER CACHE] No device found with key %s.", key);
            return [];
        } else {
            var arr = _.filter(cache.getItem(key), function(packetBundle) {
                var bundle = _.filter(packetBundle, function(packet) {
                    return packet.metadata.TYPE === 204 && packet.data.subtype === 4;
                });
                return bundle.length > 0;
            });
            return arr;
        }
    };

    //for a key, returns an array of packets which are stripped from each packet array matching packetType and subType
    this.filterAndStripByType = function(key, packetType, subType) {
        var arr = this.filterByType(key, packetType, subType);
        var returnArr = [];
        for (var i = 0; i < arr.length; i++) {
            arr[i].forEach(function(packet) {
                if (packet.metadata.TYPE === packetType && packet.data.subtype && packet.data.subtype == subType) {
                    returnArr.push(packet);
                }
            });
        }
        return returnArr;
    };

    this.getAll = function() {
        return cache.getAll();
    };

};

module.exports = DecoderCache;