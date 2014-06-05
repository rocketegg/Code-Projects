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
        }
    };
};

module.exports = Aggregator;