//computes MOS score

//Responsible for aggregating data within last time slice
//Author: Al Ho 2/22/2014
'use strict';
var DecoderCache = require('./DecoderCache.js'),
	MapReduce = require('./MapReduce.js'),
	mongoose = require('mongoose');

//given a packet (from mongo, compute MOS score)
//This takes the decoder cache and computes based on those values
function computeMetrics(packetArray) {
	var metric = {};
	metric.intervals = [];
	metric.averages = {};
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

	//compute metadata (e.g. codec)
	if (packetArray.length > 1) {
		var metadata = {};
		metadata.codec = getCodec(packetArray);
		metric.metadata = metadata;
	}

	//compute averages
	if (packetArray.length > 1) {
		var averages = {};
		var last = packetArray[packetArray.length - 1];
		var first = packetArray[0];
		var totalPackets = last.data.qos.avaya.MID_RTP_PACKET_COUNT - first.data.qos.avaya.MID_RTP_PACKET_COUNT;
		var lossTotal = last.data.qos.avaya.MID_SEQ_JUMP_INSTANCES - first.data.qos.avaya.MID_SEQ_JUMP_INSTANCES;
		var oooTotal = last.data.qos.avaya.MID_SEQ_FALL_INSTANCES - first.data.qos.avaya.MID_SEQ_FALL_INSTANCES;
		averages.duration = last.timestamp - first.timestamp;

		//rtp packets / second
		averages.rtp_packet_total = totalPackets;
		averages.rtp_rate = totalPackets / averages.duration * 1000;
		averages.rtp_loss_total = lossTotal;
		averages.rtp_loss_rate = lossTotal / totalPackets;
		averages.rtp_ooo_total = oooTotal;
		averages.rtp_ooo_rate = oooTotal / totalPackets;
		averages.rtp_jitter_snapshot = last.data.qos.avaya.MID_JITTER_BUFFER_DELAY;
		averages.rtp_jitter = (total_jitter + averages.rtp_jitter_snapshot) / averages.duration * 1000;

		averages.mos = computeMOS(averages, metadata.codec);
		metric.averages = averages;
	}

	return metric;
}

function computeStdDevs (averages) {

}

//Computes MOS Score for a device
//Based on the default E-Model, takes the metrics output as input
//Parameters:
//	averages: Averages across an arbitrary # of packets
//	codec: Codec as determined by RTCP
function computeMOS (averages, codec) {

	//Corrected: will correct based on corrected E-model which tries to approximate PESQ
	//In general: IeEff = Ie + (95 - Ie) * Ppl / (Ppl / BurstR + Bpl)
	function getIeEff(averages, codec, corrected) {
		
		var Ppl = (averages.rtp_loss_total + averages.rtp_ooo_total) / averages.rtp_packet_total * 100;
		Ppl = (corrected === true) ? getCorrectedPPl(Ppl, codec) : Ppl;

		var Bpl = rfactor_constants.codec[codec] ? rfactor_constants.codec[codec].bpl : undefined;
		var Ie = rfactor_constants.codec[codec] ? rfactor_constants.codec[codec].ie : undefined;

		if (!Ppl) {
			Ppl = 0;
		}
		if (Bpl == undefined || Ie == undefined) {
			console.log("Bpl: " + Bpl + "   ie: " + Ie)
			return 0;
		}
		var BurstR = 1;	//shark only considers BurstR = 1 (random), but it can be > 1 when packet loss is bursty rather than random

		var IeEff = Ie + (95 - Ie) * Ppl / (Ppl / BurstR + Bpl);
		return IeEff;
	}

	function getIdd(averages, codec) {

		//NOTE: This only takes the jitter delay of the last packet in the cache for now.  Need to figure out a better
		//way to compute Ta
		function computeTa(averages) {
			return averages.rtp_jitter_snapshot;
		}

		function log10(val) {
		 	return Math.log(val) / Math.LN10;
		}
		var Ta = computeTa(averages);
		var Idd = 0;

		if (Ta > 100) {
			var x = log10(Ta/100) / log10(2);
			var a = Math.pow(1 + Math.pow(x,6), 1/6);
			var b = 3 * Math.pow(1 + Math.pow((x / 3), 6), 1/6);
			var c = 2;
			Idd = 25 * (a - b + c);
		} 
		return Idd;
	}

	function convertMOS(rfactor) {
		var MOS = 1 + (0.035 * rfactor) + ((7 * rfactor) * (rfactor - 60) * (100 - rfactor) * 0.000001);
		return MOS;
	}

	var R0 = rfactor_constants.r0;
	var Is = rfactor_constants.is;
	var Idd = getIdd(averages, codec);
	var IeEff = getIeEff(averages, codec);

	var RFactor = R0 - Is - Idd - IeEff;
	var MOS = convertMOS(RFactor);

	//CORRECTED MOS here
	var IeEff_corrected = getIeEff(averages, codec, true);
	var RFactor_corrected = R0 - Is - Idd - IeEff_corrected;
	var MOS_corrected = convertMOS(RFactor_corrected);

	return {
		R0: R0,
		Is: Is,
		Idd: Idd,
		IeEff: IeEff,
		RFactor: RFactor,
		MOS: MOS,
		MOS_corrected: MOS_corrected
	}
}

// Computes MOS score based on PESQ correction function to take into account codec tandeming and other factors
// Based on paper: E-model MOdification for Case of Cascade Codecs Arrangement
// Essentially the correction function bases PESQ's intrusive approach as truth and tries to adjust
// E-model PPL to approximate PESQ values (which were discovered empirically)
var correction_coefficients = {
	'G711a': {
		a: 0.34,
		b: 0.019,
		c: 5,
		d: 0.5,
		e: -0.14
	},
	'G711u': {
		a: 0.31,
		b: 0.038,
		c: 5,
		d: 0.98,
		e: 0
	}, 
	'G729': {
		a: 0.07,
		b: 0,
		c: 0,
		d: 0,
		e: -0.0035
	},
	'G726': {
		a: -0.06,
		b: 0.0033,
		c: 6,
		d: 0.09,
		e: 0.015
	}, 
	'G723': {
		a: 0.01,
		b: 0.0115,
		c: 5,
		d: 0.315,
		e: 0.009
	}
};

function getCorrectedPPl(ppl, codec) {
	if (!correction_coefficients[codec]) {
		return ppl;
	} else {
		var MOSppl = 4.07378 + (0.17635 * ppl) + (0.00380 * ppl * ppl);	
		var a = correction_coefficients[codec].a;
		var b = correction_coefficients[codec].b * Math.pow((ppl - correction_coefficients[codec].c), 2) - correction_coefficients[codec].d;
		var c = ppl * correction_coefficients[codec].e;
		var MOSppl_ = MOSppl - (a + b + c);
		return MOSppl_;
	}
}

//CODECS are contained in the MID_PAYLOAD_TYPE of RTCP type 204 subtype 4 packets Avaya
function getCodec (packetArray) {
	var codec = '';
	var curr;
	for (var i = 0; i < packetArray.length; i++) {
		curr = packetArray[i];
		//console.log(curr.data.qos.avaya);
		if (curr.data.qos.avaya.MID_PAYLOAD_TYPE !== undefined) {
			//console.log('Found codec for packet array: %s', curr.data.qos.avaya.MID_PAYLOAD_TYPE);
			codec = avaya_constants.codec[curr.data.qos.avaya.MID_PAYLOAD_TYPE];
			break;
		}
	}
	return codec;
}

var rfactor_constants = {
	r0: 94.768,
	is: 1.42611,
	codec: {
		'G711u': {	//also, aka PCMU (G.711 mu-law)
			ie: 0,
			bpl: 25
		},
		'GSM': {	//how do these map onto RTP Payload type
			ie: 20,
			bpl: 43
		},
		'G723': {
			ie: 15,
			bpl: 16.1
		},
		'PCMA': {	//how do these map onto RTP Payload type
			ie: 0,
			bpl: 34
		},
		'G728': {	
			ie: 16,
			bpl: 27
		},
		'G729': {
			ie: 11,
			bpl: 19
		},
		'G726': {

		},
		'UNKNOWN': {
			ie: 0,
			bpl: 0
		}
	}
};

var avaya_constants = {
	codec: {
		0: 'G711u',
		4: 'G723',
		8: 'G711a',
		9: 'G722',
		15: 'G728',
		18: 'G729',
		128: 'AvayaFaxRelay',
		129: 'T38fax',
		130: 'FaxPassThru',
		131: 'TTYRelay',
		132: 'TTYPassThru',
		133: 'ModemRelay',
		134: 'ModemPassThru',
		135: 'ClearChannel',
		139: 'G726',
		255: 'unspecified'
	}
};

var Analytic = function () {
    return {
        //Compute Metrics in between two packets
        computeMetrics: function(deviceIP, cb) {
        	var cache = DecoderCache();
        	var filtered = cache.filterAndStripByType(deviceIP, 204, 4);
        	var metrics = computeMetrics(filtered);
        	if (cb)
        		cb(metrics);
        },

        //Compute MOS scores for a device
        computeMOS: function(deviceIP, cb) {
        	var cache = DecoderCache();
        	var filtered = cache.filterAndStripByType(deviceIP, 204, 4);
        	var mos = computeMOS(filtered);
        	if (cb)
        		cb(mos);
        },

        //Compute Metrics for a moving window
        computeWindow: function (deviceIP, startTime, endTime, cb) {
        	console.log(deviceIP + " " + startTime + " " + endTime);
        	var Packet = mongoose.model('Packet');
			// var query = { 
		 //        $and: [{ 
		 //          'device.IP_ADDRESS': deviceIP
		 //        }, {
		 //          'metadata.TYPE': 204
		 //        },{
		 //          'data.subtype': 4
		 //        },{
		 //          'timestamp': { 
		 //          	$gte: new Date(startTime), 
		 //          	$lte: new Date(endTime) 
		 //          }
		 //        }]
		 //      };
        	Packet.sliceByIP(deviceIP, startTime, endTime, function(err, packets) {
        		console.log('[ANALYTIC] compute window has %d packets.', packets.length);
				var metrics = computeMetrics(packets);
	        	if (cb)
	        		cb(err, metrics);
        	});
        },

        //computes metrics for a call, assuming that packet array is already received
        computeCall: function(packetArray, cb) {
        	try {
        		var metrics = computeMetrics(packetArray);
        		cb(null, metrics);
        	} catch (err) {
        		console.log(err);
        		if (cb) {
        			cb(err, {});
        		}
        	}
        }
    };
};

module.exports = Analytic;