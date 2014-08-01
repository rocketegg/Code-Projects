'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async'),
    Analytic = require('../controllers/util/Analytic.js');

/**
 * Article Schema
 */
var CallSchema = new Schema({
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date,
        default: Date.now  
    },
    //Computed MOS score and such, will be computed in RT and then stored
    metrics: {

    },
    metadata: {
        ended: {
            from: {    //based on whether a BYE packet received, needs to be received from both devices
                type: Boolean,
                default: false
            },
            to: {    //based on whether a BYE packet received, needs to be received from both devices
                type: Boolean,
                default: false
            },
            from_reason: {
                type: String,
                default: ''
            },
            to_reason: {
                type: String,
                default: ''
            }
        },

        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    from: {
        IP_ADDRESS: {
            type: String,
            default: '',
            trim: true
        },
        SSRC: {
            type: Number
        },
        src_port: {
            type: Number
        },
        dest_port: {
            type: Number
        },
        highestRTP: {   //highest RTP packet # received on FROM end
            type: Number
        },
        device: {
            type: Schema.ObjectId,
            ref: 'Device'
        }
    },
    to: {
        IP_ADDRESS: {
            type: String,
            default: '',
            trim: true
        },
        SSRC: {
            type: Number
        },
        //maps to MID_IN_RTP_SRC_PORT
        src_port: {
            type: Number
        },
        //maps to MID_IN_RTP_DEST_PORT
        dest_port: {
            type: Number
        },
        highestRTP: {   //highest RTP packet # received on TO end
            type: Number,
            default: 0
        },
        device: {
            type: Schema.ObjectId,
            ref: 'Device'
        }
    }

});

//Indexes
// CallSchema.index({ 'metadata.ended.from': 1, 'metadata.ended.to': 1, 'to.SSRC': 1, 'from.SSRC': 1, 'from.highestRTP':1});
// CallSchema.index({ 'metadata.ended.from': 1, 'metadata.ended.to': 1, 'to.SSRC': 1, 'from.SSRC': 1, 'to.highestRTP':1});
// CallSchema.index({ 'metadata.ended.from': 1, 'metadata.ended.to': 1, 'to.SSRC': 1, 'from.SSRC': 1});
CallSchema.index({ 'metadata.ended.from': 1, 'metadata.ended.to': 1});
CallSchema.index({ 'to.SSRC': 1, 'from.SSRC': 1});
CallSchema.index({ 'from.device': 1 });
CallSchema.index({ 'to.device': 1 });

CallSchema.post('init', function() {
    this._original = this.toObject();
});

function isEnded(call) {
    return (call.metadata.ended.to === true && call.metadata.ended.from === true);
}

/**
 * Statics
 */
CallSchema.statics = {
    load: function(callId, cb) {
        this.findOne({
            _id: callId
        }).exec(cb);
    },

    loadAllCallsFromDevice: function(deviceId, cb) {
        this.find({
            'from.device': deviceId
        }).select('-metrics.from.intervals').exec(cb);
    },

    loadAllCallsToDevice: function(deviceId, cb) {
        this.find({
            'to.device': deviceId
        }).select('-metrics.from.intervals').exec(cb);
    },

    loadActiveCalls: function(cb) {
        this.find({
            $or: [{
                'metadata.ended.from': false
            }, {
                'metadata.ended.to': false
            }]

        }).select('-metrics').exec(cb);
    },

    loadInactiveCalls: function(cb) {
        this.find({
            $and: [{
                'metadata.ended.from': true
            }, {
                'metadata.ended.to': true
            }]

        }).select('-metrics').exec(cb);
    },

    endCall: function(IP, SSRC, cb) {

    },

    backfillCallData: function(callId) {
        CallSchema.getPackets(callId, 0, function(err, packets) {
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
    },

    //for a call, will return packets
    getPackets: function (callId, density, cb) {
        this.findOne({
            _id: callId
        }, function(err, call) {
            if (err) throw err;
            var startTime = call.startTime;
            var endTime = call.endTime;
            //TODO: make these arrays?
            var callerIP = call.from.IP_ADDRESS;
            var receiverIP = call.to.IP_ADDRESS;
            var Packet = mongoose.model('Packet');
            console.log('[CALL] Computing packet metrics for caller IP: %s and receiver IP: %s.', callerIP, receiverIP);

            async.series([
                function (callback) {
                    Packet.sliceByIP(callerIP, startTime, endTime, function(err, packets) {
                        var result = {
                            callerIP: {
                                packets: packets
                            }
                        };
                        callback(err, result);
                    });
                },
                function (callback) {
                    Packet.sliceByIP(receiverIP, startTime, endTime, function(err, packets) {
                        var result = {
                            receiverIP: {
                                packets: packets
                            }
                        };
                        callback(err, result);
                    });
                }
            ], 
            //Optional Callback:
            //  will be of form 
            //  'IP': {
            //      packets: []    
            //  }
            function(err, results) {
                cb(err, results);
            });
        });
    }
};


mongoose.model('Call', CallSchema);
