'use strict';

/**
 * Module dependencies.
 */
var MapReduce = require('./util/MapReduce.js'),
    DecoderCache = require('./util/DecoderCache.js'),
    Analytic = require('./util/Analytic.js');

exports.reduce = function(req, res) {
    console.log('[ANALYTICS] Beginning custom MapReduce.');
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

function splitIPs(ip_string) {
  var IPs = ip_string.split(',');
  for (var i = 0; i < IPs.length; i++) {
    IPs[i] = IPs[i].trim();
  }
  return IPs;
}

exports.window = function(req, res) {
    console.log('[ANALYTICS] Returning metric interval for IPs %s.', req.query.IP_ADDRESS);
    var _analytic = new Analytic();
    var IPs = splitIPs(req.query.IP_ADDRESS);

    var countdown = IPs.length;
    var response = {};
    for (var i = 0; i < IPs.length; i++) {
        _analytic.computeMos(IPs[i], function(metrics) {
            response[IPs[i]] = metrics;
            countdown--;
            if (countdown === 0) {
                res.jsonp({
                    active_devices: response
                });
            }
        });
    }
    // _analytic.computeMos('127.0.0.1', function(metrics) {
    //     res.jsonp({
    //         active_devices: metrics
    //     });
    // });
};
