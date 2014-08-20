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

function endCall(decoded, cb) {

    var packet;
    for (var i = 0; i < decoded.length; i++) {
        if (decoded[i].metadata.TYPE === 203) {
            packet = decoded[i];
            break;
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

            var query1set = {
                $set: { 'endTime': packet.timestamp, 
                        'metadata.lastUpdated': new Date(), 
                        'metadata.ended.from': true, 
                        'metadata.ended.from_reason': packet.data.bye_reason 
                }
            };

            var query2 = {
                $and: [{
                    'to.SSRC': ssrc
                }, {
                    'metadata.ended.to': false
                }]
            };

            var query2set = {
                $set: { 'endTime': packet.timestamp, 
                        'metadata.lastUpdated': new Date(), 
                        'metadata.ended.to': true, 
                        'metadata.ended.to_reason': packet.data.bye_reason 
                }
            };

            async.waterfall([
                //First see if there is a call object
                function fromSSRC (callback) {
                    Call.collection.update(query1, query1set, {safe: true}, function(err, writeResult) {
                        if (err) throw err;
                        if (writeResult == 1) {
                            cb(err, writeResult);
                            callback('\t[SENSOR] Goodbye - Found and terminated call @ Query1 for FROM SSRC [%d] ', packet.data.ssrc);
                        } else {
                            callback(null);
                        }
                    });
                },

                //Reverse and try again - find a matching call
                function toSSRC (callback) {
                    console.log('[SENSOR] Query 1 [from: %d]: None', packet.data.ssrc);
                    Call.collection.update(query2, query2set, {safe: true}, function(err, writeResult) {
                        if (err) throw err;
                        if (writeResult == 1) {
                            cb(err, writeResult);
                            callback('\t[Sensor] Goodbye - Found and terminated call @ Query2 for TO SSRC [%d]', packet.data.ssrc );
                        } else {
                            var err = '[Sensor] Goodbye - Neither query yielded a call. Exiting';
                            callback('\t%s', err);
                            cb(err);
                        }
                    });
                },

            ], function(err, results) {

            });
        }

    }
}

//This iteration represents how call sensor was originally implemented
//NOTE that this requires SSRC spoofing to work correctly.
function updateCall(decodedPacket, cb) {
    //find existing call, update, then return
    //if no existing call found, create new call
    var Call = mongoose.model('Call');
    var Device = mongoose.model('Device');
    var IP = decodedPacket.device.IP_ADDRESS;
    var fromSSRC = decodedPacket.data.ssrc;
    var toSSRC = decodedPacket.data.ssrc_inc_rtp_stream;
    var highestRTP = decodedPacket.data.qos.avaya.MID_RTP_PACKET_COUNT;

    var query1 = {
        $and: [{
            'from.SSRC': fromSSRC
        }, {
            'to.SSRC': toSSRC
        }, {
            'metadata.ended.from': false
        }, {
            'from.IP_ADDRESS': IP
        }]
    };

    var query1set = {
        $set: { 'endTime': decodedPacket.timestamp, 
                'metadata.lastUpdated': new Date()
            },
        $max: {
            'from.highestRTP': highestRTP
        }
    };

    var query2 = {
        $and: [{
            'to.SSRC': fromSSRC
        }, {
            'from.SSRC': toSSRC
        }, {
            'metadata.ended.to': false
        }]
    };

    var query2set = {
        $set: { 'to.IP_ADDRESS': IP, 
                'endTime': decodedPacket.timestamp, 
                'metadata.lastUpdated': new Date()
            },
        $max: {
            'to.highestRTP': highestRTP 
        }
    };

    async.waterfall([

        //First see if there is a call object
        //Native mongoDB update returns writeResult:                 
        //writeResult = { "nMatched" : 1, "nUpserted" : 0, "nModified" : 1 }
        function query1 (callback) {
            Call.collection.update({
                $and: [{
                    'from.SSRC': fromSSRC
                }, {
                    'to.SSRC': toSSRC
                }, {
                    'metadata.ended.from': false
                }, {
                    'from.IP_ADDRESS': IP
                }]
            }, query1set, {safe: true}, function(err, writeResult) {
                if (err) throw err;
                //console.log(writeResult);
                if (writeResult == 1) {
                    cb(err, writeResult);   //no cache
                    callback('Found and updated call @ Query1');
                } else {
                    callback(null);
                }
            });
        },

        //No matching yet with IP, so try with just swapped SSRCs and update that one
        function query2 (callback) {
            Call.collection.update({
                $and: [{
                    'to.SSRC': fromSSRC
                }, {
                    'from.SSRC': toSSRC
                }, {
                    'metadata.ended.to': false
                }]
            }, query2set, {safe: true}, function(err, writeResult) {
                if (err) throw err;
                //console.log(writeResult);
                if (writeResult == 1) {
                    cb(err, writeResult);   //no cache
                    callback('Found and updated call @ Query2');
                } else {
                    console.log('[SENSOR] No call found, pushing new call.');
                    pushNewCall(decodedPacket, cb);
                    callback('No calls found.  Pushing new call.');
                }
            });
        }
    ], function(err, results) {

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

    //PUSH using native driver
    var Call = mongoose.model('Call');
    var newCall = {
        metrics: {},
        from: {
            IP_ADDRESS: decodedPacket.device.IP_ADDRESS,
            SSRC: decodedPacket.data.ssrc,
            highestRTP: 0
        },
        to: {
            IP_ADDRESS: '',
            SSRC: decodedPacket.data.ssrc_inc_rtp_stream,
            highestRTP: 0
        }
    };
    
    newCall.metadata = {
        ended: {
            from: false,
            to: false,
            from_reason: '',
            to_reason: '',
        },
        lastUpdated: new Date()
    };
    newCall.startTime = new Date(decodedPacket.timestamp);
    newCall.endTime = new Date(decodedPacket.timestamp);

    if (decodedPacket.data.qos) {

        if (decodedPacket.data.qos.MID_IN_RTP_SRC_PORT)
            newCall.to.src_port = decodedPacket.data.qos.MID_IN_RTP_SRC_PORT;

        if (decodedPacket.data.qos.avaya.MID_RTP_PACKET_COUNT)
            newCall.from.highestRTP = decodedPacket.data.qos.avaya.MID_RTP_PACKET_COUNT;

        if (decodedPacket.data.qos.MID_IN_RTP_DEST_PORT)
            newCall.to.dest_port = decodedPacket.data.qos.MID_IN_RTP_DEST_PORT;
    }

    Call.collection.insert(newCall, cb);
}

var Sensor = function () {
    return {
        //trackCall() - Tracks incoming calls
        //  @param decoded is a bundle of RTCP packets that have been decoded
        //  @param startCB - cb called if a call is pushed
        //  @param endCB - cb called if a call is ended
        //NOTE: Node is currently responsible for "ending calls", which
        //means that a call will only be marked as "ended" if the server
        //receiving packets receives the goodbye packet.  This may affect
        //scalability in the future and may demand use of a proxy.
        trackCall: function(decoded, startCB, endCB) {
            var decodedPacket = hasCallData(decoded);
            if (containsBye(decoded)) {
                //console.log('[SENSOR] Goodbye found.  Ending call.');
                endCall(decoded, endCB);
            } else if (!decodedPacket) {    //no call data, so we can't update anything
                //console.log('[SENSOR] No call data found.  Returning.');
                return false;
            } else {
                //console.log('[SENSOR] Updating / New call');
                updateCall(decodedPacket, startCB);
            }
        }
    };
};

module.exports = Sensor;