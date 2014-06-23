'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Call = mongoose.model('Call'),
    Analytic = require('./util/Analytic.js'),
    async = require('async'),
    Aggregator = require('./util/Aggregator.js');

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

/**
 * Get all active calls
 */
exports.allinactivecalls = function(req, res) {
    Call.loadInactiveCalls(function(err, calls) {
        if (err) {
            console.log(err);
            res.send(500, {});
        } else {
            console.log('[Calls] Found %d inactive calls.', calls.length);
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

exports.callsfordevice = function(req, res) {
    //async
    var deviceIP = req.query.IP_ADDRESS;
    if (deviceIP) {
        async.parallel([
            function(callback) {
                Call.loadAllCallsFromIP(deviceIP, function(err, results) {
                    callback(err, {
                        'from': results
                    })
                });
            },

            function(callback) {
                Call.loadAllCallsToIP(deviceIP, function(err, results) {
                    callback(err, {
                        'to': results
                    })
                });
            }
        ], function(err, results) {
            if (err) {
                res.send(500, {
                    error: err
                });
            } else {
                var response = {};
                for (var i = 0; i < results.length; i++) {
                    for (var key in results[i]) {
                        response[key] = results[i][key];
                    }
                }
                res.jsonp(response);
            } 

        });
    }
};

/**
 * Get all packets for an associated call
 */
exports.getcallpackets = function(req, res) {
    var call = req.call;
    var callId = call._id;

    if (call.metadata.ended.from === true && call.metadata.ended.to === true && call.metrics) {
        console.log('[Calls] Call is ended and already has metrics.  Formatting and returning.');
        var response = {};
        response[call.from.IP_ADDRESS] = call.metrics.from;
        response[call.to.IP_ADDRESS] = call.metrics.to;
        res.jsonp({
            active_devices: response
        });
    } else {
        var aggregator = new Aggregator();
        aggregator.updateCallStatistics(call, function(err, call) {
            if (err) {
                res.send(500, err);
            } else {
                var response = {};
                response[call.from.IP_ADDRESS] = call.metrics.from;
                response[call.to.IP_ADDRESS] = call.metrics.to;
                res.jsonp({
                    active_devices: response
                });
            }
        });
    }
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