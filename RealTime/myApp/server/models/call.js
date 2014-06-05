'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async');

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
        }
    }

});

/**
 * Statics
 */
CallSchema.statics = {
    load: function(callId, cb) {
        this.findOne({
            _id: callId
        }).exec(cb);
    },

    loadAllCallsFromIP: function(deviceIP, cb) {
        this.find({
            'from.IP_ADDRESS': deviceIP
        }).select('-metrics').exec(cb);
    },

    loadAllCallsToIP: function(deviceIP, cb) {
        this.find({
            'to.IP_ADDRESS': deviceIP
        }).select('-metrics').exec(cb);
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
