/*global emit */
var util = require('util'),
    mongoose = require('mongoose');


var MapReduceAggregator = function() {};
MapReduceAggregator.prototype.name = 'MapReduceAggregator';
MapReduceAggregator.prototype.query = function(lastRun) {
  'use strict';
  
  var timestamp = new Date().getTime();
  try {
    var packets = mongoose.model('Packet');
    console.log('[MapReduce]: Running Map Reduce @ ' + new Date());

      //mapReduce - for each packet within the time slice
      var o = {};
      o.map = function () { 
        emit(this._id, 1);
      };
      o.reduce = function (k, vals) { 
        return vals.length; 
      };
      o.verbose = true;
      o.query = { timestamp: { $gt: new Date(lastRun) }};
      // o.out = {
      //   merge: MapReduceAggregator.prototype.collection
      // };
      o.out = {
        inline: 1
      };

      packets.mapReduce(o, function(err, model, stats) {
        if (err) throw err;
        //console.log('got here:' + util.inspect(model));
        //sort results descending top 100 - these get stored into the collection
        model.find().sort({'value':-1}).limit(100).exec(function(err, documents) {
          if (err) throw err;

          //console.log('\tFound [%d] new cites.  Pushing them to %s', documents.length, MostPopularCiteStrategy.prototype.collection);
          //save last run and process time data in Analytics collection
          //analytics.record(MapReduceAggregator.prototype.name, stats, timestamp);
          console.log(MapReduceAggregator.prototype.name + ' done running in %d ms with result size [%d]', stats.processtime, documents.length);
        });
      });

  } catch (err) {
    // wait until mongoose model is registered
    throw err;
  }

  
};

module.exports = MapReduceAggregator;