//Analytics engine which computes MOS score
//and tracks QOS over time
//Author: Al Ho 2/22/2014
'use strict';
var DecoderCache = require('./DecoderCache.js'),
	MapReduce = require('./MapReduce.js'),
	mongoose = require('mongoose'),
	DeviceCache = require('./DeviceCache.js');

//computeMetrics() - given a packet array (from mongo, compute MOS score)
//This takes the decoder cache and computes based on those values
function computeMetrics(packetArray) {
	var metric = {};
	metric.intervals = [];

	//prefill values - just assumptions
	metric.averages = {
		duration: 0,
		rtp_packet_total: 0,
		rtp_rate: 0,
		rtp_loss_total: 0, 
		rtp_loss_rate: 0,
		rtp_ooo_total: 0,
		rtp_ooo_rate: 0,
		rtp_jitter_snapshot: 0,
		rtp_jitter_total: 0,
		rtp_jitter: 0,
	};
	metric.averages.mos = computeMOS(metric.averages, 'G711u');

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
		averages.rtp_jitter_total = total_jitter + averages.rtp_jitter_snapshot;
		//averages.rtp_jitter = (total_jitter + averages.rtp_jitter_snapshot) / averages.duration;	//average ms jitter over duration
		averages.rtp_jitter = averages.rtp_jitter_total / packetArray.length;

		averages.mos = computeMOS(averages, metadata.codec);
		metric.averages = averages;
	}

	return metric;
}

//Computes MOS Score for a device
//Based on the default E-Model, takes the metrics output as input
//Parameters:
//	averages: Averages across an arbitrary # of packets
//	codec: Codec as determined by RTCP
function computeMOS (averages, codec) {

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
	//var correction_factor = getCorrectedPPl(computePpl(averages), codec);
	//var MOS_corrected = MOS - correction_factor;

	//IDD Mapping functions
	//var Idd_mapped = getIdd_custom(qosCache, key, averages, packetArray)

	return {
		R0: R0,
		Is: Is,
		Idd: Idd,
		IeEff: IeEff,
		RFactor: RFactor,
		MOS: MOS,
		//MOS_corrected: MOS_corrected
	}
}

function computePpl(averages) {
	var Ppl = (averages.rtp_loss_total + averages.rtp_ooo_total) / averages.rtp_packet_total * 100;
	return Ppl;
}

//Corrected: will correct based on corrected E-model which tries to approximate PESQ
//In general: IeEff = Ie + (95 - Ie) * Ppl / (Ppl / BurstR + Bpl)
function getIeEff(averages, codec) {
	
	var Ppl = computePpl(averages);
	//Ppl = (corrected === true) ? getCorrectedPPl(Ppl, codec) : Ppl;

	var Bpl = rfactor_constants.codec[codec] ? rfactor_constants.codec[codec].bpl : undefined;
	var Ie = rfactor_constants.codec[codec] ? rfactor_constants.codec[codec].ie : undefined;

	if (!Ppl) {
		Ppl = 0;
	}
	if (Bpl == undefined || Ie == undefined) {
		//console.log("Bpl: " + Bpl + "   ie: " + Ie);
		return 0;
	}
	var BurstR = 1;	//shark only considers BurstR = 1 (random), but it can be > 1 when packet loss is bursty rather than random

	var IeEff = Ie + (95 - Ie) * Ppl / (Ppl / BurstR + Bpl);
	return IeEff;
}

//Computation #1 - 
// Just returns Idd based on the average jitter across the packets
// The problem with this is that for the average jitter to register
// in the e-model, it has to reach over 100ms.  
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

//----------------------------
//Alternative Idd Computations
//----------------------------

function getIdd_custom(qosCache, key, averages, packetArray) {
	//If std dev or average is already computed for this device
	if (qosCache.hasKey(key)) {
		var jitter = qosCache.getItem(key).jitter;
		return {
			//curr_jitter, jitter_average, jitter_std_dev, f
			iddf1: getIddFromStdDev(averages.rtp_jitter_snapshot, jitter.average, jitter.std_dev, f1),
			iddf2: getIddFromStdDev(averages.rtp_jitter_snapshot, jitter.average, jitter.std_dev, f2),
			iddg1: getIddFromAverage(averages.rtp_jitter_snapshot, jitter.average, g1)
		}
	} 

	//Else, let's compute 
	else {
		//Average jitter from all previous calls

		//Average jitter over 1 min window
		var jitter = {
   				average: averages.rtp_jitter,
   				std_dev: computeStdDevField(packetArray, 'MID_JITTER_BUFFER_DELAY', averages.rtp_jitter)
    	};
		qosCache.setItem(key, {
			jitter: jitter
		});
		getIdd2(qosCache, key, averages, packetArray);
	}
}

//TEST FUNCTIONS - the output of these functions subtracts directly from R factor
function f1(scalar, num_std_devs) {
	return num_std_devs * scalar;	//try multiplying by scalar
}	

function f2(num_std_devs) {
	return Math.pow(num_std_devs) * 2;	//try quadratic
}

function g1(percentage) {
	return percentage;	//identity
}	

//Computes the standard sample deviation of a field given a packet array
//Technically, only the packetArray is required, but will save some time
//if the average is already computed;
//Parameters:
//	packetArray - array of RTCP type 204 subtype 4 packets
//  field - avaya metric (e.g. MID_JITTER_BUFFER_DELAY)
//  average - the average of the metric used for std dev calculation
function computeStdDevField(packetArray, field, average) {
	if (average) {
		var variance = 0;
		var count = 0;
		for (var i = 0; i < packetArray.length; i++) {
			curr = packetArray[i];
			if (curr.data.qos.avaya[field]) {
				val = curr.data.qos.avaya[field];
				variance += Math.pow(val - average, 2);
				count++;
			}
		}
		variance /= count;
		return Math.pow(variance, .5);	//sqrt of variance
	} else {
		var total = 0;
		for (var i = 0; i < packetArray.length; i++) {
			curr = packetArray[i];
			if (curr.data.qos.avaya[field]) {
				total += curr.data.qos.avaya[field];
				count++;
			}
		}
		return computeStdDevField(packetArray, field, total / count);
	}
}

//getIddFromStdDev - computes Idd using a mapping function onto Idd after computing
//how many std devs apart is the jitter
function getIddFromStdDev(curr_jitter, jitter_average, jitter_std_dev, f) {
	var num_std_devs = Math.abs(curr_jitter - jitter_average) / jitter_std_dev;
	return f(num_std_devs);
}

//getIddFromAverage - computes Idd using a mapping function onto Idd after computing
//percentage of current jitter versus averaged jitter
function getIddFromAverage(curr_jitter, jitter_average, g) {
	var percent = curr_jitter / jitter_average * 100;
	return g(percent);
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

//TODO FIX THIS
function getCorrectedPPl(ppl, codec) {
	if (!correction_coefficients[codec]) {
		return 0;
	} else {
		//var MOSppl = 4.07378 + (0.17635 * ppl) + (0.00380 * ppl * ppl);	
		var a = correction_coefficients[codec].a;
		var b = correction_coefficients[codec].b * Math.pow((ppl - correction_coefficients[codec].c), 2) - correction_coefficients[codec].d;
		var c = ppl * correction_coefficients[codec].e;
		var correction_Factor = (a + b + c);
		//console.log('Correction Factor: ' + correction_Factor);
		return correction_Factor;
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

//TODO: convert to mapreduce
function averageRollup(array) {

	var stats = {};
	if (array.length === 0) { return stats; }
	//Initialize - try to find keys
	for (var i = 0; i < array.length; i++) {
		if (array[i] && Object.keys(array[i]).length > 0) {
			for (var key in array[i]) {
				if (typeof array[i][key] === 'number') {
					stats[key] = {};
					stats[key].high = 0;
					stats[key].low = 0;
					stats[key].total = 0;
					stats[key].count = 0;
					stats[key].average = 0;
				}
				else {	//e.g. for MOS score rollup
					stats[key] = averageRollup(array.map(function(j) { 
						//TODO: figure out why j is sometimes null, which crashes the server 6/27/2014
						if (j && j[key])
							return j[key]; 
						else
							return {};
					}));
				}
			}
			break;
		}
	}

	//TODO - fix when metrics is blank
	for (var i = 0; i < array.length; i++) {
		for (var key in array[i]) {
			if (typeof array[i][key] === 'number') {
				stats[key].high = Math.max(stats[key].high, array[i][key]);
				stats[key].low = Math.min(stats[key].high, array[i][key]);
				stats[key].total += array[i][key]; 
				stats[key].count += 1;
			}
		}
	}

	for (var key in stats) {
		if (stats[key].total !== undefined && stats[key].count !== undefined) {
			stats[key].average = stats[key].total / stats[key].count;
		}
	}

	return stats;

}

//TODO: convert to mapreduce
//Increments an array with a new value, useful for keeping track of lifetime averages
function incrementRollup(array, value) {

	//return

}

//backfillOtherStatistics(device) 
//For each denomination (1 min, 5, 10, hour), will compute the std dev of 
//various metrics and backfill them in the devices collection.
function backfillOtherStatistics(device, cb) {
    //console.log('\tGetting packet slice for last hour for device %s.', device._id);
    var Packet = mongoose.model('Packet');
    var endTime = device.statistics.last_updated ? device.statistics.last_updated.getTime() : new Date().getTime();
    var startTime = device.statistics.last_hour && device.statistics.last_hour.length > 0 ? device.statistics.last_hour[0].startTime.getTime() : endTime - (60 * 60000);

    Packet.sliceByIP(device.metadata.IP_ADDRESS, startTime, endTime, function(err, packets) {
        //console.log('Last hour has [%d] packets for Device %s, IP: %s', packets.length, device._id, device.metadata.IP_ADDRESS);
        var ptr = 0, variance = 0;
        var from;

        //1 - compute hour jitter variance
        if (device.statistics.last_hour && device.statistics.last_hour.rollup.length > 0 && Object.keys(device.statistics.last_hour.summary).length > 0) {
	        variance = computeVariance(packets, 'MID_JITTER_BUFFER_DELAY', device.statistics.last_hour.summary.rtp_jitter.average);
	        device.statistics.last_hour.summary.rtp_jitter.variance = variance;
	        device.statistics.last_hour.summary.rtp_jitter.stddev = Math.pow(variance, .5);
    	}

        //2 - compute ten min jitter variance
        //This if statement is needed because if there is no data for last N minutes, the rollup and summary will be blank
        if (device.statistics.last_ten_min && device.statistics.last_ten_min.rollup.length > 0 && Object.keys(device.statistics.last_ten_min.summary).length > 0) {
            var ptr = 0;
            var from = device.statistics.last_ten_min.rollup ? device.statistics.last_ten_min.rollup[0].startTime : endTime - (60000 * 10);
            for (var i = ptr; i < packets.length; i++) {
                if (packets[i].timestamp.getTime() < from) {
                    ptr++;
                } else {
                    break;
                }
            }
            variance = computeVariance(packets.slice(ptr), 'MID_JITTER_BUFFER_DELAY', device.statistics.last_ten_min.summary.rtp_jitter.average);
            device.statistics.last_ten_min.summary.rtp_jitter.variance = variance;
            device.statistics.last_ten_min.summary.rtp_jitter.stddev = Math.pow(variance, .5);
        }

        //3 - compute five min jitter variance
        if (device.statistics.last_five_min && device.statistics.last_five_min.rollup.length > 0 && Object.keys(device.statistics.last_five_min.summary).length > 0) {
            from = device.statistics.last_five_min.rollup ? device.statistics.last_five_min.rollup[0].startTime : endTime - (60000 * 5);
            for (var i = ptr; i < packets.length; i++) {
                if (packets[i].timestamp.getTime() < from) {
                    ptr++;
                } else {
                    break;
                }
            }
            variance = computeVariance(packets.slice(ptr), 'MID_JITTER_BUFFER_DELAY', device.statistics.last_five_min.summary.rtp_jitter.average);
            device.statistics.last_five_min.summary.rtp_jitter.variance = variance;
            device.statistics.last_five_min.summary.rtp_jitter.stddev = Math.pow(variance, .5);
        }

        //4 - compute min jitter variance
        if (device.statistics.last_min && device.statistics.last_min.rollup.length > 0 && Object.keys(device.statistics.last_min.summary).length > 0) {
            from = device.statistics.last_min.rollup ? device.statistics.last_min.rollup[0].startTime : endTime - (60000 * 5);
            for (var i = ptr; i < packets.length; i++) {
                if (packets[i].timestamp.getTime() < from) {
                    ptr++;
                } else {
                    break;
                }
            }
            variance = computeVariance(packets.slice(ptr), 'MID_JITTER_BUFFER_DELAY', device.statistics.last_min.summary.rtp_jitter.average);
            device.statistics.last_min.summary.rtp_jitter.variance = variance;
            device.statistics.last_min.summary.rtp_jitter.stddev = Math.pow(variance, .5);
        }

        cb(device);
    });
}


//Computes the standard sample deviation of a field given a packet array
//Technically, only the packetArray is required, but will save some time
//if the average is already computed;
//Parameters:
//  packetArray - array of RTCP type 204 subtype 4 packets
//  field - avaya metric (e.g. MID_JITTER_BUFFER_DELAY)
//  average - the average of the metric used for std dev calculation
//
//TODO (6/11/2014): If we keep a buffer of n packets (since the last update), we can
//convert this into an online algorithm which should significanly speed up
//computation.  It would work like this:
//  1) Recompute mean using new data points since last update, subtract out old packets
//  2) Subtract the variance of old data points, Add in variance of new data points
//  3) Recompute Std Dev
//It would require some tuning to get right, for example
//some considerations are:
//  1) When do we throw out the buffer and just compute std dev across the whole
//     window again?  (e.g. data is stale for 1 hour, 10 min, 5 min, etc)
function computeVariance(packetArray, field, average) {
	if (!packetArray || packetArray.length === 0) {
		return 0;
	}

    if (average || average === 0) {
        var variance = 0;
        for (var i = 0; i < packetArray.length; i++) {
            var curr = packetArray[i];
            if (curr.data.qos.avaya[field]) {
                var val = curr.data.qos.avaya[field];
                variance += Math.pow(val - average, 2);
            }
        }
        variance /= packetArray.length;
        return variance;
    } else {
        var total = 0;
        var count = 0;
        for (var i = 0; i < packetArray.length; i++) {
            var curr = packetArray[i];
            if (curr.data.qos.avaya[field]) {
                total += curr.data.qos.avaya[field];
                count++;
            }
        }
        return computeVariance(packetArray, field, (count > 0) ? total / count : 0);
    }
}

// This is a singleton instance that computes metrics based on a packet array.
// It obfuscates the computation of MOS score from consumers, so all that is 
// needed is an array of RTCP 204 subtype 4 packets.

// It also keeps track of internal metrics that are used to approximate Idd for 
// a MOS score computation.  This is kept in the QOS cache object and is indexed
// by the IP address of the device for which MOS score was computed.
// Date: 6/6/2014
var Analytic = function () {
    if (Analytic.prototype._singletonInstance) {
        return Analytic.prototype._singletonInstance;
    }

    Analytic.prototype._singletonInstance = this;

    //Compute Metrics in between two packets
    this.computeMetrics = function(deviceIP, cb) {
    	//console.log('Computing Metrics for %s' + deviceIP);
    	var Packet = mongoose.model('Packet');
    	var currTime = new Date().getTime();
    	var startTime = new Date(currTime - 60000);
    	Packet.sliceByIP(deviceIP, startTime, currTime, function(err, filtered) {
			var metrics = computeMetrics(filtered);
	    	if (cb)
	    		cb(err, metrics);
    	});
    	
    };

    //Compute MOS scores for a device
    this.computeMOS = function(deviceIP, cb) {
    	//var cache = DecoderCache();
    	//var filtered = cache.filterAndStripByType(deviceIP, 204, 4);
    	var Packet = mongoose.model('Packet');
    	var currTime = new Date().getTime();
    	var startTime = new Date(currTime - 60000);
    	Packet.sliceByIP(deviceIP, startTime, currTime, function(err, filtered) {
	    	var mos = computeMOS(filtered);
	    	if (cb)
	    		cb(mos);
	    });
    };

    //Compute Metrics for a moving window
    this.computeWindow = function (deviceIP, startTime, endTime, cb) {
    	console.log(deviceIP + " " + startTime + " " + endTime);
    	var Packet = mongoose.model('Packet');
    	Packet.sliceByIP(deviceIP, startTime, endTime, function(err, packets) {
    		console.log('[ANALYTIC] compute window has %d packets.', packets.length);
			var metrics = computeMetrics(packets);
        	if (cb)
        		cb(err, metrics);
    	});
    };

    //computes metrics for a call, assuming that packet array is already received
    this.computeCall = function(packetArray, cb) {
    	try {
    		var metrics = computeMetrics(packetArray);
    		cb(null, metrics);
    	} catch (err) {
    		console.log(err);
    		if (cb) {
    			cb(err, {});
    		}
    	}
    };

    //takes a rollup array (see Aggregator.js or Device.js) and finds high, low, average across duration
    //can be called with a callback or serially
    this.averageRollups = function(averageArray, cb) {
    	if (cb) {
    		cb(averageRollup(averageArray));
    	} else {
    		return averageRollup(averageArray);
    	}
    };

    //backfills other statistics - requires a callback because this queries the Packets collection
    this.backfillOtherStatistics = function(device, cb) {
    	backfillOtherStatistics(device, cb);
    };
};

module.exports = Analytic;