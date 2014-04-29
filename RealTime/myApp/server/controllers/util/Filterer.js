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

      //Compute average metrics 
      var qos = {};
      _reduce.stats.unique_ips.forEach(function(ip) {
        qos[ip] = {
            interarrival_jitter: 0,
            cumulative_lost_packets: 0,
            num_packets: 0
          };
      });

      packets.forEach(function(packet) {
        if (packet.metadata.TYPE === 200) {
          if (packet.data.report_blocks.length > 0) {
            var int_jitter = 0;
            var cumulative_lost = 0;
            //sum the jitter and cumulative lost and average it out
            packet.data.report_blocks.forEach(function(rb) {
              int_jitter += rb.interarrival_jitter;
              cumulative_lost += rb.cumulative_lost;
            });
            int_jitter = int_jitter / packet.data.report_blocks.length;
            cumulative_lost = cumulative_lost / packet.data.report_blocks.length;

            //add to the average qos
            qos[packet.device.IP_ADDRESS].interarrival_jitter += int_jitter;
            qos[packet.device.IP_ADDRESS].cumulative_lost_packets += cumulative_lost;
            qos[packet.device.IP_ADDRESS].num_packets += 1;
          }
        }
      });

      //console.log(JSON.stringify(qos, undefined, 2));

      for (var key in qos) {
        var avg_jitter = qos[key].num_packets > 0 ? qos[key].interarrival_jitter / qos[key].num_packets : 0;

        _reduce.stats.qos.push({
          device: key,
          interarrival_jitter: avg_jitter,
          cumulative_lost_packets: qos[key].cumulative_lost_packets
        });
      }

      //console.log(JSON.stringify(_reduce.stats.qos, undefined, 2));

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