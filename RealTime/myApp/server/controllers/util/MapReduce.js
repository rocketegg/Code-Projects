/*global emit */
var util = require('util'),
    mongoose = require('mongoose');


var MapReduceAggregator = function() {};
MapReduceAggregator.prototype.name = 'MapReduceAggregator';

/*
 * This function performs a custom map reduce based on the device signature (e.g. IP address or extension)
 * and will compute the high, low and average of the metricKey for a given time slice.
 * MetricKey is an array of metrics of a 204 packet type avaya subtype
 */
//Unfortunately the MR driver needs global variables to do this.
var _device,
    _metricKey,
    startTime,
    endTime;
MapReduceAggregator.prototype.query = function(device, metricKey, startTime, endTime, cb) {
  'use strict';
  
  console.log('[MapReduce]: Querying [%s] with metrics: [%s] for time slice [%s] to [%s]', device.IP_ADDRESS, metricKey, new Date(startTime), new Date(endTime));
  try {
    var packets = mongoose.model('Packet');

      //mapReduce - for each packet within the time slice
      var o = {};

      _device = device;
      _metricKey = metricKey;
      console.log(metricKey);
      o.scope = {};
      o.scope.device = device;
      o.scope.metricKey = metricKey;
      o.map = function () {
        if (this.device.IP_ADDRESS == device.IP_ADDRESS) {
          if (this.metadata.TYPE == 204) {
            var value = {};
            for (var i = 0; i < metricKey.length; i++) {
              value[metricKey[i]] = this.data.qos.avaya[metricKey[i]];
            }
            emit(this.device.IP_ADDRESS, value);
          }
        }
        //emit(this.device.IP_ADDRESS, 1);
      };

      //Key is (IP_ADDR, array of value {with each metric key});
      o.reduce = function (key, metrics) {
        var reduced = {};
        for (var i = 0; i < metricKey.length; i++) {
          reduced[metricKey[i]] = {
            high: 0,
            total: 0,
            count: 0,
            low: -1
          };
        }

        for (var idx = 0; idx < metrics.length; idx++) {
          for (var key in metrics[idx]) {
            reduced[key].count += 1;
            reduced[key].high = Math.max(reduced[key].high, metrics[idx][key]);
            reduced[key].total += metrics[idx][key];
            if (reduced[key].low == -1) {
              reduced[key].low = metrics[idx][key];
            } else {
              reduced[key].low = Math.min(reduced[key].low, metrics[idx][key]);
            }
          }
        }

        return reduced;
        //return metrics.length;
      };
      o.verbose = true;
      o.query = { timestamp: { $gte: new Date(startTime), $lte: new Date(endTime) }};
      // o.out = {
      //   merge: MapReduceAggregator.prototype.collection
      // };
      o.out = {
        inline: 1
      };

      packets.mapReduce(o, function(err, results) {
        if (err) throw err;
        console.log(util.inspect(results));
        cb(err, results);
        //console.log('got here:' + util.inspect(model));
        //sort results descending top 100 - these get stored into the collection
        // model.find().sort({'value':-1}).limit(100).exec(function(err, documents) {
        //   if (err) throw err;

        //   //console.log('\tFound [%d] new cites.  Pushing them to %s', documents.length, MostPopularCiteStrategy.prototype.collection);
        //   //save last run and process time data in Analytics collection
        //   //analytics.record(MapReduceAggregator.prototype.name, stats, timestamp);
        //   console.log(MapReduceAggregator.prototype.name + ' done running in %d ms with result size [%d]', stats.processtime, documents.length);
        // });
      });

  } catch (err) {
    cb(err);
  }

  
};

var MapReduce = function () {
    return {
        //For a particular device, compute the metric for a time period
        //device is an object {
        //  IP: blah or
        //  Extension: blah
        //}
        reduce: function(device, metricKey, startTime, endTime, cb) {
          console.log('[MapReduce]: Running Map Reduce @ ' + new Date());
          var reducer = new MapReduceAggregator();
          reducer.query(device, metricKey, startTime, endTime, function(err, results) {
            if (err) throw err;
            cb(err, results);
          });
        }
    };
};

module.exports = MapReduce;