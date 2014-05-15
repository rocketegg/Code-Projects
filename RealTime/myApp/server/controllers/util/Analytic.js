//computes MOS score

//Responsible for aggregating data within last time slice
//Author: Al Ho 2/22/2014
'use strict';
var DecoderCache = require('./DecoderCache.js');

//given a packet (from mongo, compute MOS score)
//This takes the decoder cache and computes based on those values
function computeMetrics(packetArray) {
	var metric = {};
	metric.intervals = [];
	var prev, curr;

	//compute intervals
	var total_jitter = 0;
	for (var i = 0; i < packetArray.length - 1; i++) {
		prev = packetArray[i];
		curr = packetArray[i+1];
		var interval = {};
		interval.timestamp = curr.timestamp;
		interval.duration = curr.timestamp - prev.timestamp;	//duration in millis
		interval.rtp_total_packet_count = curr.data.qos.avaya.MID_RTP_PACKET_COUNT;
		interval.rtp_interval_packets = curr.data.qos.avaya.MID_RTP_PACKET_COUNT - prev.data.qos.avaya.MID_RTP_PACKET_COUNT;

		interval.rtp_total_packet_loss = curr.data.qos.avaya.MID_SEQ_JUMP_INSTANCES;
		interval.rtp_interval_packet_loss = curr.data.qos.avaya.MID_SEQ_JUMP_INSTANCES - prev.data.qos.avaya.MID_SEQ_JUMP_INSTANCES;

		interval.rtp_total_packet_out_of_order = curr.data.qos.avaya.MID_SEQ_FALL_INSTANCES;
		interval.rtp_interval_packets_out_of_order = curr.data.qos.avaya.MID_SEQ_FALL_INSTANCES - prev.data.qos.avaya.MID_SEQ_FALL_INSTANCES;

		interval.jitter_buffer_delay = curr.data.qos.avaya.MID_JITTER_BUFFER_DELAY;
		total_jitter += prev.data.qos.avaya.MID_JITTER_BUFFER_DELAY;
		metric.intervals.push(interval);
	}

	//compute averages
	if (packetArray.length > 1) {
		var averages = {};
		var last = packetArray[packetArray.length - 1];
		var first = packetArray[0];
		averages.duration = last.timestamp - first.timestamp;

		//rtp packets / second
		averages.rtp_rate = (last.data.qos.avaya.MID_RTP_PACKET_COUNT - first.data.qos.avaya.MID_RTP_PACKET_COUNT) / averages.duration * 1000;
		averages.rtp_loss_rate = (last.data.qos.avaya.MID_SEQ_JUMP_INSTANCES - first.data.qos.avaya.MID_SEQ_JUMP_INSTANCES) / averages.duration * 1000;
		averages.rtp_ooo_rate = (last.data.qos.avaya.MID_SEQ_FALL_INSTANCES - first.data.qos.avaya.MID_SEQ_FALL_INSTANCES) / averages.duration * 1000;
		averages.rtp_jitter = (total_jitter + last.data.qos.avaya.MID_JITTER_BUFFER_DELAY) / averages.duration * 1000;
		metric.averages = averages;
	}

	return metric;
}

var Analytic = function () {
    return {
        //Compute MOS in between two packets
        computeMos: function(deviceIP, cb) {
        	var cache = DecoderCache();
        	var filtered = cache.filterAndStripByType(deviceIP, 204, 4);
        	var metrics = computeMetrics(filtered);
        	if (cb)
        		cb(metrics);
        }
    };
};

module.exports = Analytic;