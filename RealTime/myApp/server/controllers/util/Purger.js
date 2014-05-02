//Responsible for aggregating data within last time slice
//Author: Al Ho 2/22/2014
'use strict';
var mongoose = require('mongoose');

var Purger = function () {
    return {
        //Purge up to an hour ago
        purge: function(cb) {
            var removeDate = new Date().getTime() - (60 * 60 * 1000);
            console.log('[PURGER] Purging results @ [%s]', new Date());
            var Packet = mongoose.model('Packet');

            Packet.find({
                timestamp: {
                    $lt: removeDate
                }
            }, function (err, packets) {
                if (err) throw err;
                
                console.log('\t[PURGER] Removing [%d] packets from Packets collection @ [%s]', packets.length, new Date(removeDate));
                packets.forEach(function(packet) {
                    packet.remove();
                });
            });

            var Reduce = mongoose.model('Reduce');
            Reduce.find({
                timestamp: {
                    $lt: removeDate
                }
            }, function (err, packets) {
                if (err) throw err;
                
                console.log('\t[PURGER] Removing [%d] packets from Reduce collection @ [%s]', packets.length, new Date(removeDate));
                packets.forEach(function(packet) {
                    packet.remove();
                });
            });
        }
    };
};

module.exports = Purger;