/*global emit */
var util = require('util'),
    mongoose = require('mongoose');


var MapReduceAggregator = function() {};
MapReduceAggregator.prototype.name = 'MapReduceAggregator';

/*
 * This function performs a custom map reduce based on the device signature (by IP address)
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
      o.verbose = true;

      o.query = { 
        $and: [{ 
          'device.IP_ADDRESS': device.IP_ADDRESS 
        }, {
          'metadata.TYPE': 204
        }]
      };
      
      //Assumes a matching IP and 204 style packet
      o.map = function () {
        var value = {};
        for (var i = 0; i < metricKey.length; i++) {
          value[metricKey[i]] = {
            high: this.data.qos.avaya[metricKey[i]],
            low: this.data.qos.avaya[metricKey[i]],
            total: this.data.qos.avaya[metricKey[i]],
            count: 1
          }
        }
        emit(this.device.IP_ADDRESS, value);
      };

      //Key is (IP_ADDR, array of value {with each metric key: {high, low, total, count}});
      o.reduce = function (key, values) {
        var result = {};

        //initialize return result
        for (var i = 0; i < metricKey.length; i++) {
          result[metricKey[i]] = {
            high: 0,
            low: -1,
            total: 0,
            count: 0
          }
        }

        for (var idx = 0; idx < metricKey.length; idx++) {
          var _key = metricKey[idx];
          for (var i = 0; i < values.length; i ++) {
            result[_key].high = Math.max(result[_key].high, values[i][_key].high);
            result[_key].low = result[_key].low == -1 ? values[i][_key].low : Math.min(result[_key].low, values[i][_key].low);
            result[_key].total = result[_key].total + values[i][_key].total;
            result[_key].count = result[_key].count + values[i][_key].count;
          }
        }
        return result;
      };

      // o.out = {
      //   merge: MapReduceAggregator.prototype.collection
      // };
      o.out = {
        inline: 1
      };

      packets.mapReduce(o, function(err, results) {
        if (err) throw err;
        console.log(JSON.stringify(results, undefined, 2));

        //console.log('got here:' + util.inspect(model));
        //sort results descending top 100 - these get stored into the collection
        // model.find().sort({'value':-1}).limit(100).exec(function(err, documents) {
        //   if (err) throw err;

        //   //console.log('\tFound [%d] new cites.  Pushing them to %s', documents.length, MostPopularCiteStrategy.prototype.collection);
        //   //save last run and process time data in Analytics collection
        //   //analytics.record(MapReduceAggregator.prototype.name, stats, timestamp);
        //   console.log(MapReduceAggregator.prototype.name + ' done running in %d ms with result size [%d]', stats.processtime, documents.length);
        // });
        cb(err, results);
      });

  } catch (err) {
    cb(err);
  }
};

function findIPByExtension(extension, startTime, endTime, cb) {
  console.log('[MapReduce] Attempting to find IP Address for extension: %s', extension);
  var Packet = mongoose.model('Packet');
  Packet.find({
    $and: [{
        'metadata.TYPE': 202,
      }, {
        timestamp: { $gte: new Date(startTime), $lte: new Date(endTime) }
      }]
  }, function(err, packets) {
      if (err) {
        console.log(err);
        throw err;
      }
      var IP;
      for (var i = 0; i < packets.length; i++) {
        for (var j = 0; j < packets[j].data.chunks.length; j++) {
          var sdes_items = packets[i].data.chunks[j].sdes_items;
          if (sdes_items[1].value == extension) {
            
            if (IP && IP !== packets[i].device.IP_ADDRESS) {
              console.log('\tThat\'s weird, different IP addresses [%s,%s] for same extension: %s', IP, packets[i].device.IP_ADDRESS, extension);
              IP = packets[i].device.IP_ADDRESS;
            } else if (!IP) {
              IP = packets[i].device.IP_ADDRESS;
              console.log('\tFound extension %s in a packet with _id: %s and IP: %s', extension, packets[i]._id, packets[i].device.IP_ADDRESS);
            }
          }
        } 
      }
      cb(err, IP);
  });
}

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

          if (device.IP_ADDRESS) {
            reducer.query(device, metricKey, startTime, endTime, function(err, results) {
              if (err) throw err;
              cb(err, results);
            });
          } else if (device.extension) {
            findIPByExtension(device.extension, startTime, endTime, function(err, IP_ADDRESS) {
              if (err) throw err;

              if (IP_ADDRESS) {
                console.log("[MapReduce]: Found IP Address %s for Extension %s.  Proceeding.", IP_ADDRESS, device.extension);
                device.IP_ADDRESS = IP_ADDRESS
                reducer.query(device, metricKey, startTime, endTime, function(err, results) {
                  if (err) throw err;
                  cb(err, results);
                });
              } else {
                cb('Could not identify IP Address for extension.', {});
              }

            });

          }

        }
    };
};

module.exports = MapReduce;