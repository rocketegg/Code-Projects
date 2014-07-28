'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Device = mongoose.model('Device'),
    async = require('async'),
    json2csv = require('json2csv'),
    Analytic = require('./util/Analytic.js'),
    ArrayUtils = require('./util/generic/ArrayUtils.js');

//Return all devices
exports.all = function(req, res) {
    Device.find().select('-statistics').exec(function(err, devices) {
        if (err) {
            console.log(err);
            res.send(500, {});
        } else {
            console.log('[Devices] Found %d devices.', devices.length);
            res.jsonp(devices);
        }
    });
};

exports.show = function(req, res) {
    res.jsonp(req.device);
};

exports.device = function(req, res, next, id) {
    Device.load(id, function(err, device) {
        if (err) return next(err);
        if (!device) return next(new Error('Failed to load device ' + id));
        req.device = device;
        next();
    });
};

exports.find = function(req, res) {
    var query = {}; //constructed query to match params
	if (req.query.IP_ADDRESS) {
        query['metadata.IP_ADDRESS'] = req.query.IP_ADDRESS;
    }

    if (req.query.EXT) {
        query['metadata.SDES.PHONE'] = { $regex: '.*' + req.query.EXT + '.*'}
    }

	Device.find(deviceIP, function(err, device) {
        if (err) {
            res.send(500, {
                error: err
            });
        } 
        if (!device) {
            res.send(200, {});
        } else {
            res.jsonp(device);
        }
    });
};

// findsummarybyip() - queries the 1, 5, 10 and hour summary for a device by IP address
// This query does not return the rollup array for the device.
//  GET: /device/find/summary?IP_ADDRESS=127.0.0.1
//  params: 
//      IP_ADDRESS: an IP address
exports.findsummarybyip = function(req, res) {
    var deviceIP = req.query.IP_ADDRESS;
    Device.loadSummaryByIP(deviceIP, function(err, device) {
        if (err) {
            res.send(500, {
                error: err
            });
        } 
        if (!device) {
            res.send(200, {});
        } else {
            res.jsonp(device);
        }
    });
};

// snapshot() - queries both the decoder cache and the current device summary and aggregates
// the result and returns it in the format requested
//  GET: /device/find/snapshot?IP_ADDRESS=127.0.0.1&format=csv
//  params: 
//      IP_ADDRESS: an IP address
//      format: csv, raw
exports.snapshot = function(req, res) {
    var deviceIP = req.query.IP_ADDRESS;
    var format = req.query.format;
    async.series([
        function(callback) {
            Device.loadSummaryByIP(deviceIP, function(err, device) {
                callback(err, device);
            });
        },

        function(callback) {
            var _analytic = new Analytic();
            _analytic.computeMetrics([deviceIP], function(metrics) {
                callback(undefined, metrics);
            });
        }

    ], function(err, results) {
        if (err) {
            res.send(500, {
                error: err
            });
        } else {
            if (format && format === 'raw') {
                res.jsonp(results);
            } else if (!format || format === 'csv') {
                //convert to csv then send
                var _arrayUtils = new ArrayUtils();
                if (results[1]) {
                    var obj = _arrayUtils.flatten(results[1].averages);
                    obj.codec = results[1].metadata ? results[1].metadata.codec : 'unknown';
                    if (results[1].intervals && results[1].intervals.length > 0) {
                        obj.startTime = results[1].intervals[0].timestamp;
                        obj.endTime = results[1].intervals[results[1].intervals.length-1].timestamp;
                    } else {
                        obj.startTime = 0;
                        obj.endTime = 0;
                    }
                    
                    //loaded summary
                    if (results[0]) {
                        var data = results[0];
                        obj.std_dev_jitter_hour = data.statistics.last_hour.summary.rtp_jitter ? data.statistics.last_hour.summary.rtp_jitter.stddev : 0;
                        obj.std_dev_jitter_ten_min = data.statistics.last_ten_min.summary.rtp_jitter ? data.statistics.last_ten_min.summary.rtp_jitter.stddev : 0;
                        obj.std_dev_jitter_five_min = data.statistics.last_five_min.summary.rtp_jitter ? data.statistics.last_five_min.summary.rtp_jitter.stddev : 0;
                        obj.std_dev_jitter_min = data.statistics.last_min.summary.rtp_jitter ? data.statistics.last_min.summary.rtp_jitter.stddev : 0;

                        obj.jitter_average_all_calls = data.calls.all_calls.summary.rtp_jitter ? data.calls.all_calls.summary.rtp_jitter.average : 0;
                        obj.jitter_average_last_ten_calls = data.calls.last_ten_calls.summary.rtp_jitter ? data.calls.last_ten_calls.summary.rtp_jitter.average : 0;
                        obj.jitter_average_last_five_calls = data.calls.last_five_calls.summary.rtp_jitter ? data.calls.last_five_calls.summary.rtp_jitter.stddev : 0;
                        obj.jitter_average_last_call = data.calls.last_call.summary.rtp_jitter ? data.calls.last_call.summary.rtp_jitter.stddev : 0;
                    } else {
                        obj.std_dev_jitter_hour = 0;
                        obj.std_dev_jitter_ten_min = 0;
                        obj.std_dev_jitter_five_min = 0;
                        obj.std_dev_jitter_min = 0;
                        obj.jitter_average_all_calls = 0;
                        obj.jitter_average_last_ten_calls = 0;
                        obj.jitter_average_last_five_calls = 0;
                        obj.jitter_average_last_call = 0;
                    }

                    var _fields = Object.keys(obj).sort();
                    json2csv({data: obj, fields: _fields}, 
                        function(err, csv) {
                            if (err) {
                                res.send(500, {
                                    error: err
                                });
                            } else {
                                res.send(200, csv);
                            }
                        }
                    );
                }
            }
        }
    });
};
