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
            rollup: [],  //averages at the stalenessThreshold interval (see Aggregator.js)
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
        all_calls: {
            rollup: [], //contains average per call
            summary: {}
        },
        last_updated: {
            type: Date
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
            'statistics.last_ten_min.rollup': 0
        }).exec(cb);
    },

    //when a call ends, update the statistics for this device
    updateStatisticsForCall: function(IP_ADDRESS, callId, cb) {

    },

    //given a starttime, update all stale statistics
    updateStatistics: function(IP_ADDRESS, cb) {

    },

    //will reset all statistics for this device
    resetStatistics: function(IP_ADDRESS) {

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
