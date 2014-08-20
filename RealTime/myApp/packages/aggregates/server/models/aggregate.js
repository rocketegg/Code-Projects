'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async');

/**
 * Aggregate Schema
 */
var AggregateSchema = new Schema({
    
    //Computed MOS score and such, will be computed in RT and then stored
    metadata: {
        lastRun: {
            type: Date,
            default: Date.now
        },

        name: {
            type: String
        },

        description: {
            type: String
        },

        interval: { //Interval between runs in ms
            type: Number
        },

        nextRun: {
            type: Date,
            default: Date.now
        }

    },

    aggregate: {
        startTime: {
            type: Date
        },

        endTime: {
            type: Date
        },

        frequency: {
            type: Number    //frequency to run this aggregate in millis
        },

        ips: [String],   //a string of IPs to aggregate against

        devices: [{
            type: Schema.ObjectId,
            ref: 'Device'
        }],

        calls: [{
            type: Schema.ObjectId,
            ref: 'Call'
        }]
    },

    result: [] //result of running the query through the aggregation framework, pushes a result and runtime
    
});

AggregateSchema.methods = {

    run: function(callback) {
        console.log('Running %s.', this.name);
        //run
        if (this.interval > 0) {
            this.lastRun = currTime = new Date().getTime();
            this.nextRun = new Date(currTime + interval);
            this.save(callback);
        } else {
            callback(null, 'Not rescheduling %s because interval <= 0', this.name)
        }
    }
}

mongoose.model('Aggregate', AggregateSchema);
