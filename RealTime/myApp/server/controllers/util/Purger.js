//Responsible for aggregating data within last time slice
//Author: Al Ho 2/22/2014
'use strict';
var mongoose = require('mongoose');

var expirationThreshold = 300000;   //5 min, calls without update for this value will be ended
var removePacketThreshold = 60 * 60 * 1000;     //1 hour, packets older than this value will be deleted
var removeCallThreshold = 60 * 60 * 1000 * 24;     //1 day, calls older than this value will be deleted

var Purger = function () {
    return {

        //Handles deletes out of DB
        purge: function(cb) {
            var removeDate = new Date().getTime() - removePacketThreshold;
            //console.log('[PURGER] Purging results @ [%s]', new Date());
            var Packet = mongoose.model('Packet');

            Packet.find({
                timestamp: {
                    $lt: removeDate
                }
            }, function (err, packets) {
                if (err) throw err;
                if (packets.length > 0) {
                    console.log('\t[PURGER] Removing [%d] packets from Packets collection @ [%s]', packets.length, new Date(removeDate));
                    packets.forEach(function(packet) {
                        packet.remove();
                    });
                }
            });

            var callRemoveDate = new Date().getTime() - removeCallThreshold;  //last day
            var Call = mongoose.model('Call');

            Call.find({
                startTime: {
                    $lt: callRemoveDate
                }
            }, function (err, calls) {
                if (err) throw err;
                
                if (calls.length > 0) {
                    console.log('\t[PURGER] Removing [%d] calls (older than 1 day) from calls collection @ [%s]', calls.length, new Date(callRemoveDate));
                    calls.forEach(function(call) {
                        call.remove();
                    });  
                }

            });

            var Reduce = mongoose.model('Reduce');
            Reduce.find({
                timestamp: {
                    $lt: removeDate
                }
            }, function (err, packets) {
                if (err) throw err;
                
                if (packets.length > 0) {
                    console.log('\t[PURGER] Removing [%d] packets from Reduce collection @ [%s]', packets.length, new Date(removeDate));
                    packets.forEach(function(packet) {
                        packet.remove();
                    }); 
                }
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
                        calls[i].endTime = new Date();
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