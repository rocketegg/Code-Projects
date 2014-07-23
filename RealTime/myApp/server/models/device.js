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
        SDES: {},
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
    },

    /*
    * This function will backfill a device using data gathered by the SDES packet (202) which is sent wth
    * 200 sender reports.  If the device is found, then the options are populated into the device (where
    * the packet is passed in).  
    * An SDES packet looks like this stored in the packets collection:
        "data" : {
        "chunks" : [
            {
                "sdes_items" : [
                    {
                        "value" : "ext4152222001@10.30.12.50:2146",
                        "length" : 30,
                        "type" : 1
                    },
                    {
                        "value" : "4152222001",
                        "length" : 10,
                        "type" : 4
                    },
                    {
                        "value" : "Avaya IP Telephone (ha96xxua3_1_03_S)",
                        "length" : 37,
                        "type" : 6
                    }
                ],
                "ssrc" : 1207325079
            }
        ],
        "length" : 22
    },
    * According to the RFC 3550, here are the subtypes of sdes items: 
    *   1: CNAME: Canonical End-Point Identifier SDES Item
    *   2: NAME: User Name SDES Item
    *   3: EMAIL: Electronic Mail Address SDES Item
    *   4: PHONE: Phone Number SDES Item
    *   5: LOC: Geographic User Location SDES Item
    *   6: TOOL: Application or Tool Name SDES Item
    *   7: NOTE: Notice/Status SDES Item
    *   8: PRIV: Private Extensions SDES Item
    */
    backfillDevice: function(query, _SDESpacket, callback) {
        this.findOne(query, function(err, device) {
            if (err) throw err;
            if (device) {
                if (_SDESpacket && _SDESpacket.data.chunks && _SDESpacket.data.chunks.length > 0) {
                    if (!device.metadata.SDES) {
                        device.metadata.SDES = {};
                    }

                    //Handle items
                    _SDESpacket.data.chunks[0].sdes_items.forEach(function(item) {
                        switch(item.type) {
                            case 1:
                                device.metadata.SDES.CNAME = item.value;
                                break;
                            case 2:
                                device.metadata.SDES.NAME = item.value;
                                break;
                            case 3:
                                device.metadata.SDES.EMAIL = item.value;
                                break;
                            case 4:
                                device.metadata.SDES.PHONE = item.value;
                                break;
                            case 5:
                                device.metadata.SDES.LOC = item.value;
                                break;
                            case 6:
                                device.metadata.SDES.TOOL = item.value;
                                break;
                            case 7:
                                device.metadata.SDES.NOTE = item.value;
                                break;
                            case 8:
                                device.metadata.SDES.PRIV = item.value;
                                break;
                        }
                    });

                    device.save(callback);
                }
            }
        })
    }
};

mongoose.model('Device', DeviceSchema);
