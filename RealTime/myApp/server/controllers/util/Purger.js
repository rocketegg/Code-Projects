//Responsible for aggregating data within last time slice
//Author: Al Ho 2/22/2014
'use strict';
var mongoose = require('mongoose');

var expirationThreshold = 300000;   //5 minutes

var Purger = function () {
    return {
        //Purge up to an hour ago
        purge: function(cb) {
            var removeDate = new Date().getTime() - (60 * 60 * 1000);
            //console.log('[PURGER] Purging results @ [%s]', new Date());
            var Packet = mongoose.model('Packet');

            Packet.find({
                timestamp: {
                    $lt: removeDate
                }
            }, function (err, packets) {
                if (err) throw err;
                
                //console.log('\t[PURGER] Removing [%d] packets from Packets collection @ [%s]', packets.length, new Date(removeDate));
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
                
                //console.log('\t[PURGER] Removing [%d] packets from Reduce collection @ [%s]', packets.length, new Date(removeDate));
                packets.forEach(function(packet) {
                    packet.remove();
                });
            });
        },

        expireCalls: function(cb) {
            var Call = mongoose.model('Call');
            Call.loadActiveCalls(function(err, calls) {
                if (err) throw err;
                var currTime = new Date().getTime();
                for (var i = 0; i < calls.length; i++) {
                    var lastUpdateTime = calls[i].metadata.lastUpdated.getTime();
                    if (currTime - lastUpdateTime > expirationThreshold) {
                        console.log('[PURGER]: Call %s timed out.  Marking as inactive.', calls[i]._id);
                        calls[i].metadata.ended.from = true;
                        calls[i].metadata.ended.to = true;
                        if (!calls[i].metadata.ended.from_reason || calls[i].metadata.ended.from_reason === '') {
                            calls[i].metadata.ended.from_reason = 'Timed out'
                        }
                        if (!calls[i].metadata.ended.to_reason || calls[i].metadata.ended.to_reason === '') {
                            calls[i].metadata.ended.to_reason = 'Timed out'
                        }
                        calls[i].save();
                    }
                }
            })
        }
    };
};

module.exports = Purger;