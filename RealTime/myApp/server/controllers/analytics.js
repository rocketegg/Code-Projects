'use strict';

/**
 * Module dependencies.
 */
var MapReduce = require('./util/MapReduce.js'),
    Analytic = require('./util/Analytic.js'),
    async = require('async');

exports.reduce = function(req, res) {
    console.log('[ANALYTICS] Beginning MapReduce for high/low/average.');
    console.log(JSON.stringify(req.body));
    var startTime = req.body.startTime;
    var endTime = req.body.endTime;
    var device = req.body.device;
    var metricKeys = req.body.metricKeys;

    var reducer = new MapReduce();
    reducer.reduce(device, metricKeys, startTime, endTime, function(err, results) {
        if (err) {
            console.log(err);
            res.jsonp({
                error: err
            });
        } else {
            for (var i = 0; i < results.length; i++) {
                var keys = Object.keys(results[i].value);
                results[i].emitted = results[i].value[keys[0]].count;
            }

            res.jsonp(results);
        }

    });
};

// qos() - Queries the packets collection and compute the metrics for all packets returned
// in the window
//  GET: /analytics/qos?device=127.0.0.1&endTime=####&startTime=####
//  params: 
//      startTime: start time (unix time in ms)
//      endTime: end time (unix time in ms)
//      device: an ip address
exports.qos = function(req, res) {
    console.log('[ANALYTICS] Beginning QOS computation statistics.');
    console.log(JSON.stringify(req.query));
    var startTime = parseInt(req.query.startTime);
    var endTime = parseInt(req.query.endTime);
    var device = req.query.device;

    var _analytic = new Analytic();
    _analytic.computeWindow(device, startTime, endTime, function(err, results) {
        if (err) throw err;
        else
            res.jsonp(results);
    });
};

function splitIPs(ip_string) {
  var IPs = ip_string.split(',');
  for (var i = 0; i < IPs.length; i++) {
    IPs[i] = IPs[i].trim();
    //IP Validation
    if (!(/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/i.test(IPs[i]))) {
        console.log('Invalid IP' + IPs[i]);
        IPs.splice(i, 1);
    }
  }
  return IPs;
}

// window() - Queries the decoder cache and compute the metrics for a list of IPs with packets
// in the decoder cache
//  GET: /analytics/window?IP_ADDRESS=127.0.0.1, 10.30.172.47
//  params: 
//      IP_ADDRESS: a string of IP addresses (comma separated). This will be split and validated.
exports.window = function(req, res) {
    console.log('[ANALYTICS] Returning metric interval for IPs %s.', req.query.IP_ADDRESS);
    var _analytic = new Analytic();
    var IPs = splitIPs(req.query.IP_ADDRESS);
    var self = {
        IPs: IPs,
        countdown: IPs.length,
        response: {}
    };

    var response = {};

    var asyncFunctions = [];
    IPs.forEach(function(IP) {
        IP = IP.trim();
        asyncFunctions.push(function(callback) {
            _analytic.computeMetrics(IP, function(err, metrics) {
                var response = {};
                response[IP] = metrics;
                callback(err, response);
            });
        });
    })

    async.parallel(asyncFunctions, function(err, results) {
        var response = {};
        for (var i = 0; i < results.length; i++) {
            var key = Object.keys(results[i])[0];
            response[key] = results[i][key];
        }
        res.jsonp({
            active_devices: response
        });
    });
};









