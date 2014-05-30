'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Call = mongoose.model('Call'),
    Analytic = require('./util/Analytic.js'),
    async = require('async');

/**
 * Get all active calls
 */
exports.allactivecalls = function(req, res) {
    Call.loadActiveCalls(function(err, calls) {
        if (err) {
            console.log(err);
            res.send(500, {});
        } else {
            console.log('[Calls] Found %d active calls.', calls.length);
            res.jsonp(calls);
        }
    });
};

//Return all calls
exports.all = function(req, res) {
    Call.find().exec(function(err, calls) {
        if (err) {
            console.log(err);
            res.send(500, {});
        } else {
            console.log('[Calls] Found %d calls.', calls.length);
            res.jsonp(calls);
        }
    });
};

/**
 * Get all packets for an associated call
 */
exports.getcallpackets = function(req, res) {
    var call = req.call;
    var callId = call._id;

    Call.getPackets(callId, 0, function(err, packets) {
        if (err) {
            console.log(err);
            res.send(500, {});
        } else {
            console.log('[Calls] Found %d packets for call %s.', packets.length, callId);
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
                res.jsonp({
                    active_devices: response
                });
            });

        }
    });
};

exports.show = function(req, res) {
    res.jsonp(req.call);
};

exports.call = function(req, res, next, id) {
    Call.load(id, function(err, call) {
        if (err) return next(err);
        if (!call) return next(new Error('Failed to load call ' + id));
        req.call = call;
        next();
    });
};