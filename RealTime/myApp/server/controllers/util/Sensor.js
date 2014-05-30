//Sensor.js tries to detect when a call begins/ends based on the RTCP packet bundle
//Detecting CALLS in progress
//  Keeps tracks of what endpoints (based on incoming packets) are currently 
//  sending packets.  Based on the packets, sees from and to and if there's a match
//  will start storing the call data in the Call collection.  If the packets
//  contain a "BYE" packet or the RTP packet count resets, Sensor assumes that
//  the call has been ended and will update the Call collection accordingly
//Author: Al Ho 5/28/2014
'use strict';
var mongoose = require('mongoose'),
    async = require('async');

/*
* CALL LOGIC
*/

//decoded - array of compound packets (most recently decoded bundle)
function hasCallData(decoded) {
    var decodedPacket;
    for (var i = 0; i < decoded.length; i++) {
        var packet = decoded[i];
        if (packet.metadata.TYPE === 204 && packet.data.subtype && packet.data.subtype == 4)
            decodedPacket = packet;
    }
    return decodedPacket;
}

//cache - array of compound packets, decodedPacket - a 204/4 packet
var MAX_RTCP_REPORTING_INTERVAL = 30000;    //30s
function callExists(cache, decodedPacket) {

    //returns true if timestamps are within a threshold (i.e. MAX RTCP reporting interval)
    function withinTimeThreshold(timestamp1, timestamp2) {
        if (timestamp1 instanceof Date) {
            timestamp1 = timestamp1.getTime();
        }

        if (timestamp2 instanceof Date) {
            timestamp2 = timestamp2.getTime();
        }

        return Math.abs(timestamp1 - timestamp2) > MAX_RTCP_REPORTING_INTERVAL ? false : true;
    }

    var lastDecoded = cache[cache.length-1];

    if (lastDecoded) {
        var currRTP = lastDecoded.data.qos.avaya.MID_RTP_PACKET_COUNT;
        var decodedRTP = decodedPacket.data.qos.avaya.MID_RTP_PACKET_COUNT;

        console.log('[Sensor] Curr highest RTP packet # is [%d].  Decoded RTP packet # is [%d].', currRTP, decodedRTP);
        if (decodedRTP > currRTP && withinTimeThreshold(lastDecoded.timestamp, decodedPacket.timestmap)) {
            //this is a continuing call
            return true;
        } else {
            return false;
        }
    } else {    
        //no last packet, so assume that this will be a new call
        //TODO: will have to determine whether the call is stored in mongo
        return false;
    }
    
}

function endCall(decoded, cb) {

    var packet;
    for (var i = 0; i < decoded.length; i++) {
        if (decoded[i].metadata.TYPE === 203) {
            packet = decoded[i];
        }
    }

    if (!packet) {
        return;
    } else {
        var Call = mongoose.model('Call');
        var IP = packet.device.IP_ADDRESS;
        if (packet.data.ssrc && packet.data.ssrc.length > 0) {
            var ssrc = packet.data.ssrc[0];
            var query1 = {
                $and: [{
                    'from.SSRC': ssrc
                }, {
                    'metadata.ended.from': false
                }]
            };

            var query2 = {
                $and: [{
                    'to.SSRC': ssrc
                }, {
                    'metadata.ended.to': false
                }]
            };

            Call.find(query1, function(err, calls) {
                if (calls.length > 1) {
                    console.log('uh oh, multiple calls');
                } else if (calls.length === 1) {
                    console.log('Found call. Ending');
                    var call = calls[0];
                    call.endTime = packet.timestamp;
                    call.metadata.lastUpdated = new Date();
                    call.metadata.ended.from = true;
                    call.metadata.ended.from_reason = packet.data.bye_reason;

                    call.save(function(err) {
                        cb(err, call);
                    });
                } else {
                    console.log('[Sensor] No calls found.  Reversing and trying again.');
                    Call.find(query2, function(err, calls) {
                        if (calls.length > 1) {
                            console.log('uh oh, multiple calls');
                        } else if (calls.length === 1) {
                            console.log('Found call. Ending');
                            var call = calls[0];
                            call.endTime = packet.timestamp;
                            call.metadata.lastUpdated = new Date();
                            call.metadata.ended.to = true;
                            call.metadata.ended.to_reason = packet.data.bye_reason;

                            call.save(function(err) {
                                cb(err, call);
                            });
                        } else {
                            console.log('[Sensor] No calls found!');
                        }
                    });
                }
            });
        }
    }
}

function updateCall(decodedPacket, cb) {
    //find existing call, update, then return
    //if no existing call found, create new call
    var Call = mongoose.model('Call');
    var IP = decodedPacket.device.IP_ADDRESS;
    var fromSSRC = decodedPacket.data.ssrc;
    var toSSRC = decodedPacket.data.ssrc_inc_rtp_stream;
    var highestRTP = decodedPacket.data.qos.avaya.MID_RTP_PACKET_COUNT;

    var query1 = {
        $and: [{
            'from.IP_ADDRESS': IP
        }, {
            'from.SSRC': fromSSRC
        }, {
            'to.SSRC': toSSRC
        }, {
            'metadata.ended.from': false
        }, {
            'from.highestRTP': {
                $lt: highestRTP
            }
        }]
    };

    var query2 = {
        $and: [{
            'to.SSRC': fromSSRC
        }, {
            'from.SSRC': toSSRC
        }, {
            'metadata.ended.to': false
        }, {
            'to.highestRTP': {
                $lt: highestRTP
            }
        }]
    };

    //1 - try finding call
    Call.find(query1, function(err, calls) {
        console.log(calls);
        if (calls.length > 1) {
            console.log('uh oh! multiple calls found');
        } else if (calls.length === 1) {
            console.log('[Sensor] Found existing call (query1).  Updating');
            var call = calls[0];
            call.endTime = decodedPacket.timestamp;
            call.metadata.lastUpdated = new Date();
            call.from.highestRTP = highestRTP;

            call.save(function(err) {
                cb(err, call);
            });
        } else {
            //2 - try finding call reversed
            console.log('[Sensor] No calls found.  Reversing and trying again.');
            Call.find(query2, function(err, calls) {
                if (calls.length > 1) {
                    console.log('uh oh! multiple calls found');
                } else if (calls.length === 1) {
                    console.log('[Sensor] Found existing call (query2).  Updating');
                    var call = calls[0];
                    call.to.IP_ADDRESS = IP;
                    call.endTime = decodedPacket.timestamp;
                    call.metadata.lastUpdated = new Date();
                    call.to.highestRTP = highestRTP;

                    call.save(function(err) {
                        cb(err, call);
                    });
                } else {
                    pushNewCall(decodedPacket, cb);
                }
            });
        }
    });
    return true;
}

function containsBye(decoded) {
    return decoded.map(function(packet) {return packet.metadata.TYPE;}).indexOf(203) > -1 ? true : false;
}

/*
* DB Hooks
*/
function pushNewCall(decodedPacket, cb) {
    var Call = mongoose.model('Call');
    var newCall = new Call();

    newCall.startTime = decodedPacket.timestamp;
    newCall.endTime = decodedPacket.timestamp;
    newCall.from.IP_ADDRESS = decodedPacket.device.IP_ADDRESS;
    newCall.from.SSRC = decodedPacket.data.ssrc;
    newCall.to.SSRC = decodedPacket.data.ssrc_inc_rtp_stream;
    if (decodedPacket.data.qos) {

        if (decodedPacket.data.qos.MID_IN_RTP_SRC_PORT)
            newCall.to.src_port = decodedPacket.data.qos.MID_IN_RTP_SRC_PORT;

        if (decodedPacket.data.qos.avaya.MID_RTP_PACKET_COUNT)
            newCall.from.highestRTP = decodedPacket.data.qos.avaya.MID_RTP_PACKET_COUNT;

        if (decodedPacket.data.qos.MID_IN_RTP_DEST_PORT)
            newCall.to.dest_port = decodedPacket.data.qos.MID_IN_RTP_DEST_PORT;
    }

    newCall.save(function(err) {
        cb(err, newCall);
    });
}

var Sensor = function () {
    return {
        //Track incoming calls
        //Cache is the current state 
        //Decoded is a bundle of RTCP packets that have been decoded
        //StartCB - cb called if a call is pushed
        //EndCB - cb called if a call is ended
        trackCall: function(cache, decoded, startCB, endCB) {
            //console.log(cache);
            var decodedPacket = hasCallData(decoded);
            if (containsBye(decoded)) {
                console.log('[Sensor] Goodbye found.  Ending call.');
                endCall(decoded, endCB);
            } else if (!decodedPacket) {    //no call data, so we can't update anything
                console.log('[Sensor] No call data found.  Returning.');
                return false;
            } else if (callExists(cache, decodedPacket)) {
                console.log('[Sensor] Updating / New call');
                updateCall(decodedPacket, startCB);
            }
        }
    };
};

module.exports = Sensor;