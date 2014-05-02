'use strict';

/**
 * Module dependencies.
 */
var MapReduce = require('./util/MapReduce.js');

exports.reduce = function(req, res) {
    console.log('[ANALYTICS] Beginning custom MapReduce.');
    console.log(JSON.stringify(req.body));
    var startTime = req.body.startTime;
    var endTime = req.body.endTime;
    var device = req.body.device;
    var metricKeys = req.body.metricKeys;

    var reducer = new MapReduce();
    reducer.reduce(device, metricKeys, startTime, endTime, function(err, results) {
        if (err) throw err;
        res.jsonp(results);
    });
};
