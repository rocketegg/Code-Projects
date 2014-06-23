'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async'),
    Analytic = require('../controllers/util/Analytic.js');

/**
 * Device Schema
 */
var DeviceSchema = new Schema({
    created: {
        type: Date,
        default: Date.now
    },

    metadata: {
        IP_ADDRESS: {
            type: String,
            default: '',
            trim: true
        },
        SSRC: [Number]   //all known SSRCs
    },

    //These will be backfilled over time
    statistics: {
        last_min: {
            //If there is data, it will be of this form:
            //averages at the stalenessThreshold interval (see Aggregator.js)
            rollup: [
                //metrics: {} - an array of computed metrics for this rollup interval
                //numPackets: number - the number of packets in the rollup
                //endTime: endTime of rollup
                //startTime: startTime of rollup

            ],  
            summary: {} //averages, sums, std devs across whole rollup window
        },
        last_five_min: {
            rollup: [],
            summary: {}
        },
        last_ten_min: {
            rollup: [],
            summary: {}
        },
        last_hour: {
            rollup: [],
            summary: {}
        },
        last_updated: {
            type: Date
        }
    },

    calls: {
        last_call: {
            rollup: [],
            summary: {
                //will contain average metrics across rollup window
            }
        },
        last_five_calls: {
            rollup: [],
            summary: {}
        },
        last_ten_calls: {
            rollup: [],
            summary: {}
        },
        all_calls: {
            rollup: [],
            summary: {}
        }
    }
});

//Backfill 1, 5 and 10 minutes based on hourly data
DeviceSchema.pre('save', function(next) {
    if (this.statistics.last_hour.rollup && this.statistics.last_hour.rollup.length > 1) {
        var ptr, ptr_min, ptr_five_min, ptr_ten_min = ptr_five_min = ptr_min = ptr = this.statistics.last_hour.rollup.length - 1;
        var currTimestamp = this.statistics.last_updated;
        var lookbackThreshold = currTimestamp - (10 * 60000);

        while (this.statistics.last_hour.rollup[ptr] && this.statistics.last_hour.rollup[ptr].endTime >= lookbackThreshold) {
            var timestamp = this.statistics.last_hour.rollup[ptr].endTime;
            //1 min lookback
            if (timestamp >= currTimestamp - 60000) {
                ptr_min = ptr;
            }
            //5 min lookback
            if (timestamp >= currTimestamp - (60000 * 5)) {
                ptr_five_min = ptr;
            }
            //10 min lookback
            if (timestamp >= currTimestamp - (60000 * 10)) {
                ptr_ten_min = ptr;
            }
            ptr--;
        }

        this.statistics.last_min.rollup = this.statistics.last_hour.rollup.slice(ptr_min, this.statistics.last_hour.rollup.length - 1);
        this.statistics.last_five_min.rollup = this.statistics.last_hour.rollup.slice(ptr_five_min, this.statistics.last_hour.rollup.length - 1);
        this.statistics.last_ten_min.rollup = this.statistics.last_hour.rollup.slice(ptr_ten_min, this.statistics.last_hour.rollup.length - 1);

        var _analytic = new Analytic();
        
        //This function backfills averages across the rollup window
        this.statistics.last_min.summary = _analytic.averageRollups(this.statistics.last_min.rollup.map(function(i) { return i.metrics; }));
        this.statistics.last_five_min.summary = _analytic.averageRollups(this.statistics.last_five_min.rollup.map(function(i) { return i.metrics; }));
        this.statistics.last_ten_min.summary = _analytic.averageRollups(this.statistics.last_ten_min.rollup.map(function(i) { return i.metrics; }));
        this.statistics.last_hour.summary = _analytic.averageRollups(this.statistics.last_hour.rollup.map(function(i) { return i.metrics; }));

        var device = this;

        //This function backfills std dev and variances
        _analytic.backfillOtherStatistics(device, function(updated) {
            device.statistics.last_min.summary = updated.statistics.last_min.summary;
            device.statistics.last_five_min.summary = updated.statistics.last_five_min.summary;
            device.statistics.last_ten_min.summary = updated.statistics.last_ten_min.summary;
            device.statistics.last_hour.summary = updated.statistics.last_hour.summary;
            next();
        });
    } else {
        next();     
    }
});

//This function takes the last call and updates metrics in the device
//Currently we keep track of
//  - All Calls (all calls, and summary over all calls)
//  - Last call 
//  - Last five calls
//  - Last 10 calls 
//  - The data format follows that of the statistics object
function updateLastCall(device, _call, cb) {
    var _analytic = new Analytic();

    //initialization
    if (!device.calls.all_calls) {
        device.calls.all_calls = {};
        device.calls.all_calls.rollup = [];
        device.calls.last_five_calls = {};
        device.calls.last_five_calls.rollup = [];
        device.calls.last_five_calls = {};
        device.calls.last_five_calls.rollup = [];
    }

    var metricsForCall;
    var IP_ADDRESS = device.metadata.IP_ADDRESS;
    if (_call.metrics && _call.metrics.from.IP_ADDRESS === IP_ADDRESS) {
        metricsForCall = _call.metrics.from.averages;
    } else if (_call.metrics && _call.metrics.to.IP_ADDRESS === IP_ADDRESS) {
        metricsForCall = _call.metrics.to.averages;
    }

    device.calls.all_calls.rollup.push({
        metrics: metricsForCall
    });

    var last = device.calls.all_calls.rollup.length - 1;
    device.calls.all_calls.rollup[last].callId = _call._id;
    //TODO - We can implement an online algorithm to update summaries (will be faster than computing across entire call array)
    //var lastsummary = device.calls.all_calls.summary;
    //device.calls.all_calls.summary = incrementSummary(lastsummary, metricsForCall);

    //get slices
    device.calls.last_call.rollup = device.calls.all_calls.rollup.slice(-1);
    device.calls.last_five_calls.rollup = device.calls.all_calls.rollup.slice(-5);
    device.calls.last_ten_calls.rollup = device.calls.all_calls.rollup.slice(-10);

    //compute new summaries
    device.calls.last_call.summary = _analytic.averageRollups(device.calls.last_call.rollup.map(function(i) { return i.metrics; }));
    device.calls.last_five_calls.summary = _analytic.averageRollups(device.calls.last_five_calls.rollup.map(function(i) { return i.metrics; }));
    device.calls.last_ten_calls.summary = _analytic.averageRollups(device.calls.last_ten_calls.rollup.map(function(i) { return i.metrics; }));
    device.calls.all_calls.summary = _analytic.averageRollups(device.calls.all_calls.rollup.map(function(i) { return i.metrics; }));
    
    device.save(cb);
}

DeviceSchema.statics = {
    load: function(deviceId, cb) {
        this.findOne({
            _id: deviceId
        }).exec(cb);
    },

    loadByIP: function(IP_ADDRESS, cb) {
        this.findOne({
            'metadata.IP_ADDRESS': IP_ADDRESS
        }).exec(cb);
    },

    loadSummaryByIP: function(IP_ADDRESS, cb) {
        this.findOne({
            'metadata.IP_ADDRESS': IP_ADDRESS
        }).select({
            'statistics.last_min.rollup': 0, 
            'statistics.last_hour.rollup': 0,
            'statistics.last_five_min.rollup': 0,
            'statistics.last_ten_min.rollup': 0,
            'calls.last_call.rollup': 0, 
            'calls.last_five_calls.rollup': 0,
            'calls.last_ten_calls.rollup': 0,
            'calls.all_calls.rollup': 0
        }).exec(cb);
    },

    //when a call ends, update the statistics for this device
    updateDeviceCall: function(IP_ADDRESS, callId, cb) {
        console.log('[DEVICE]: Updating device call for IP %s and callID %s.', IP_ADDRESS, callId);
        this.findOne({
            'metadata.IP_ADDRESS': IP_ADDRESS
        }, function(err, device) {
            if (err) throw err;

            if (!device) {
                cb(err, device);
            } else {
                //update last call
                if (!device.calls) {
                    device.calls = {};
                }

                var Call = mongoose.model('Call');
                Call.load(callId, function(err, _call) {
                    updateLastCall(device, _call, cb);
                });
            }
        });
    },

    //will reset all statistics for this device
    resetStatistics: function(IP_ADDRESS, cb) {
        DeviceSchema.loadByIP(IP_ADDRESS, function(err, device) {
            if (err) throw err;

            if (!device) {
                cb(err, device);
            } else {
                var _blankStats = {
                    last_min: {
                        rollup: [],  
                        summary: {}
                    },
                    last_five_min: {
                        rollup: [],
                        summary: {}
                    },
                    last_ten_min: {
                        rollup: [],
                        summary: {}
                    },
                    last_hour: {
                        rollup: [],
                        summary: {}
                    },
                    last_updated: {
                        type: Date
                    }
                };

                var _blankCalls = {
                    last_call: {
                        rollup: [],
                        summary: {}
                    },
                    last_five_calls: {
                        rollup: [],
                        summary: {}
                    },
                    last_ten_calls: {
                        rollup: [],
                        summary: {}
                    },
                    all_calls: {
                        rollup: [],
                        summary: {}
                    }
                }
                device.statistics = _blankStats;
                device.calls = _blankCalls;
                device.save(cb);
            }
        });
    },

    registerIfNecessary: function(IP_ADDRESS) {
        this.findOne({
            'metadata.IP_ADDRESS': IP_ADDRESS
        }, function(err, device) {
            if (err) throw err;
            if (!device) {
                var Device = mongoose.model('Device');
                device = new Device();
                device.metadata.IP_ADDRESS = IP_ADDRESS;
                device.save();
            }
        })
    }
};

mongoose.model('Device', DeviceSchema);
