/*global emit */
var util = require('util'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;


var Filterer = function() {};
Filterer.prototype.name = 'Filterer';
Filterer.prototype.query = function(lastRun, cb) {
  'use strict';
  
  var timestamp = new Date().getTime();
  console.log('[Filterer]: Filtering results for range: [%s] to [%s]', new Date(lastRun), new Date());
  try {
    var packets = mongoose.model('Packet');
    packets.find({
      timestamp: {
        $gte: lastRun
      }
    }, function(err, packets) {
      if (err) throw err;

      var Reduce = mongoose.model('Reduce');
      var _reduce = new Reduce();
      _reduce.timestamp = lastRun;

      var packet_distribution = [];

      packets.forEach(function(packet) {
        //Add IP to the set
        _reduce.stats.unique_ips.addToSet(packet.device.IP_ADDRESS);

        //add to packet_distribution
        var packet_type_exists = false;
        packet_distribution.forEach(function(packet_type) {
          if (packet_type.type === packet.metadata.TYPE) {
            packet_type.count += 1;
            packet_type_exists = true;
          } 
        });
        if (!packet_type_exists) {
          packet_distribution.push({
            type: packet.metadata.TYPE,
            count: 1
          });
        }

      });

      _reduce.stats.total_packets = packets.length;
      _reduce.stats.packet_distribution = packet_distribution;

      //console.log(JSON.stringify(_reduce));
      _reduce.save(cb);

    });

  } catch (err) {
    // wait until mongoose model is registered
    throw err;
  }
};

module.exports = Filterer;