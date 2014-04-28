'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * Article Schema
 */
var ReduceSchema = new Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    stats: {

        //Total # of packets in the time slice
        total_packets: {
            type: Number
        },

        //For each unique IP, add
        unique_ips: [String],

        //For each unique packet received, increment
        packet_distribution: [new Schema({
            type: {
                type: Number
            },
            count: {
                type: Number
            }
        }, {
            _id: false
        })]
    }
});

/**
 * Statics
 */
ReduceSchema.statics = {
    load: function(id, cb) {
        this.findOne({
            _id: id
        }).exec(cb);
    },
    slice: function (startTime, endTime, density, cb) {
        this.find({
          timestamp: {
            $gte: startTime, 
            $lt: endTime
          }
        }).exec(cb);
    }
};


mongoose.model('Reduce', ReduceSchema);
