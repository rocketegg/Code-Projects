//Responsible for aggregating data within last time slice
//Author: Al Ho 2/22/2014
'use strict';
var Reducer = require('./MapReduce.js'),
    Filterer = require('./Filterer.js'),
    mongoose = require('mongoose'),
    Analytic = require('./Analytic.js'),
    async = require('async');

//Since lastRun, will find all newly ended calls and will
//backfill their qos data.  
function backfillCallData(lastRun) {
    var Call = mongoose.model('Call');
    var query = {
        $and: [{
            'metadata.ended.from': true
        }, {
            'metadata.ended.to': true
        }, {
            'endTime': {
                $gte: lastRun   //i.e. newly expired
            }
        }]
    }
    Call.find(query, function(err, calls) {
        if (err) throw err;
        if (calls.length > 0) {
            console.log('[AGGREGATOR]: Backfilling call data for [%d] new expired calls.', calls.length);
            calls.forEach(function(call) {
                var callId = call._id;

                Call.getPackets(callId, 0, function(err, packets) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('\t[AGGREGATOR] Backfilling call %s.', callId);
                        var _analytic = new Analytic();
                        async.parallel([
                            //caller
                            function(callback) {
                                _analytic.computeCall(packets[0].callerIP.packets, function(err, metrics) {
                                    var callerIP = call.from.IP_ADDRESS;
                                    var results = {};
                                    results[callerIP] = metrics;
                                    callback(err, results);
                                });
                            },
                            function(callback) {
                                _analytic.computeCall(packets[1].receiverIP.packets, function(err, metrics) {
                                    var receiverIP = call.to.IP_ADDRESS;
                                    var results = {};
                                    results[receiverIP] = metrics;
                                    callback(err, results);
                                });
                            }
                        ], function(err, results) {
                            var response = {};
                            for (var i = 0; i < results.length; i++) {
                                for (var key in results[i]) {
                                    response[key] = results[i][key];
                                }
                            }
                            console.log('\t[AGGREGATOR] Saving call data for call %s.', callId);
                            call.metrics = {
                                from: {
                                    IP_ADDRESS: call.from.IP_ADDRESS,
                                    intervals: response[call.from.IP_ADDRESS].intervals,
                                    averages: response[call.from.IP_ADDRESS].averages,
                                    metadata: response[call.from.IP_ADDRESS].metadata
                                },
                                to: {
                                    IP_ADDRESS: call.to.IP_ADDRESS,
                                    intervals: response[call.to.IP_ADDRESS].intervals,
                                    averages: response[call.to.IP_ADDRESS].averages,
                                    metadata: response[call.to.IP_ADDRESS].metadata
                                }
                            };
                            call.save();
                        });

                    }
                });

            })
        }
    });
}

//updateStatistics()
//
//For a device, will backfill QOS data based on Analytic.computeMetrics
//
//It works like this: Based on the last update and the stalenessThreshold, the function
//will grab the last n packets (n being the window size from the last update, up to the last hour's worth of data)
//Then based on how old the data is, the analytics engine computes the QoS data per time slice
//  Example:
//     - If the stalenessThreshold is 30 seconds (30000), then it will backfill the last minute with 2 chunks
//       last 5 minutes with 10 chunks, last 10 min with 20 chunks and last hour with 120 chunks.
//     - If the stalenessThreshold is 15 seconds (15000), then it will backfill the last minute with 4 chunks,
//       last 5 minutes with 20 chunks, last 10 min with 40 chunks and last hour with 240 chunks.
//  This function is run periodically (as set within server.js), but will only initiate if the lastUpdate 
//  is older than the stalenessThreshold.
//  
//  Documented: AMH 6/9/2014
function updateStatistics(device, cb) {
    var _analytic = new Analytic();
    var currTimestamp = new Date().getTime();
    console.log('[AGGREGATOR]: Computing metrics for device %s.', device.metadata.IP_ADDRESS);

    //Purge all stale data
    if (device.statistics.last_hour.rollup && device.statistics.last_hour.rollup.length > 0) {
        var ptr = 0;
        while (device.statistics.last_hour.rollup[ptr] && device.statistics.last_hour.rollup[ptr].endTime < currTimestamp - (60000 * 60)) {
            ptr++;
        }
        console.log('\tPurging stale hourly data [%d rows] for device %s', ptr, device.metadata.IP_ADDRESS);
        device.statistics.last_hour.rollup.splice(0, ptr);
    }

    //1) Get packets
    var lastUpdate = device.statistics.last_updated;
    var startTime;
    var endTime = currTimestamp;

    if (lastUpdate) {
        //if older than 1 hour
        if (currTimestamp - lastUpdate.getTime() > (60000 * 60) || lastUpdate.getTime() > currTimestamp) {
            startTime = currTimestamp - (60000 * 60);
        } else {
            startTime = lastUpdate.getTime();
        }
    } else {
        startTime = currTimestamp - (60000 * 60);
    }
    //the number of updates needed, adjustable based on staleness Threshold size
    var numUpdates = Math.floor((currTimestamp - startTime) / stalenessThreshold);
    console.log('[AGGREGATOR]: Backfilling %s for past %d minutes.', device.metadata.IP_ADDRESS, numUpdates);

    var Packet = mongoose.model('Packet');

    //2) For all packets within the slice, bucketize into stalenessTHreshold size buckets and
    //compute QoS statistics
    Packet.sliceByIP(device.metadata.IP_ADDRESS, startTime, endTime, function(err, packets) {
        var pLow = 0;
        var pHigh = 0;

        for (var i = 0; i < numUpdates; i++) {
            //1 - Determine starting slice
            var startSlice = startTime + (i * stalenessThreshold);
            var endSlice = startSlice + stalenessThreshold;
            var store = {};

            //2 - Determine packets within the slice
            var pLowTimestamp = packets[pLow] ? packets[pLow].timestamp.getTime() : startSlice - 1;
            if (pLowTimestamp >= startSlice && pLowTimestamp <= endSlice) {
                pHigh = pLow;

                while ( packets[pHigh] && 
                        packets[pHigh].timestamp.getTime() >= startSlice && 
                        packets[pHigh].timestamp.getTime() < endSlice) {
                    pHigh++;
                }

                var slice = packets.slice(pLow, pHigh);

                //3 - Compute metrics
                _analytic.computeCall(slice, function(err, metrics) {
                    store = {
                        startTime: startSlice,
                        endTime: endSlice,
                        numPackets: pHigh - pLow,
                        metrics: metrics.averages
                    };
                    //store the store
                });
                pLow = pHigh;
            } else {
                //3 - Compute metrics
                store = {
                    startTime: startSlice,
                    endTime: endSlice,
                    numPackets: 0,
                    metrics: {}
                };
            }

            //4 - Store
            device.statistics.last_hour.rollup.push(store);
            device.statistics.last_updated = store.endTime;
        }
        //console.log('\tSaving device hour stats for device %s IP: %s.  New size is %d.', device._id, device.metadata.IP_ADDRESS, device.statistics.last_hour.rollup.length);
        device.save(cb);
    });
}

//stalenessThreshold (MAX: 60000)
//this is the minimum threshold to kick off a new backfilling update (1 minute by default)
var stalenessThreshold = 60000; 
var Aggregator = function () {
    return {
        //TODO serialize these through call backs
        aggregateAll: function(cb) {
            var _reducer = new Reducer();
            var _filterer = new Filterer();
            var lastRun = new Date().getTime() - 5000;
            //console.log('[AGGREGATOR] Aggregating results @ [%s]', new Date());
            _filterer.query(lastRun);
            backfillCallData(lastRun);
            //_reducer.query(lastRun);
        },

        //Updates all devices in devices collection, if no devices, does nothing
        updateStatistics: function(deviceIP, cb) {
            var Device = mongoose.model('Device');
            Device.find({}, function(err, devices) {
                devices.forEach(function(device) {
                    if (!device.statistics.last_updated || (new Date().getTime() - device.statistics.last_updated.getTime() > stalenessThreshold) || device.statistics.last_updated.getTime() > new Date().getTime()) {
                        console.log('[AGGREGATOR]: Updating statistics for device %s.', device.metadata.IP_ADDRESS);
                        updateStatistics(device, cb);
                    } else {
                        //console.log(device.statistics.last_updated);
                        //console.log('[AGGREGATOR]: Device %s is up to date.', device.metadata.IP_ADDRESS);
                        if (cb)
                            cb(undefined, {});
                    }
                });
            });
        }
    };
};

module.exports = Aggregator;