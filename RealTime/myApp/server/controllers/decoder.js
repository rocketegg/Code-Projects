//Author: Al Ho 2/22/2014
'use strict';
var fs = require('fs'),
    mongoose = require('mongoose');

var decoders = {
    '200': decode_200,  //SENDER REPORT
    '201': decode_201,  //RECEIVER REPORT
    '202': decode_202,  //SOURCE DESCRIPTION
    '203': decode_203,  //GOODBYE
    '204': decode_204   //APPLICATION-DEFINED
};

function makeid() {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

//Entry method
function decode (msg, rinfo, filename, captureOn) {
    function writeToFile(msg, filename) {
        if (!filename) {
            filename = 'rtcp_packets_' + makeid();
        }
        console.log('---Writing byte stream to: ' + filename);
        var wstream = fs.createWriteStream('./packets/' + filename);
        wstream.write(msg);
        wstream.end();
        console.log('---Done.');
    }

    try {
        var timestamp = new Date().getTime();
        console.log('[DECODE]: Decoding udp message with timestamp: %s.', timestamp);

        if (captureOn)
            writeToFile(msg, filename);

        var decoded = [];   //This code currently runs synchronously, pushing each decoded packet on the array, which is returned
        decode_packets(msg, rinfo, 0, timestamp, decoded);
        return decoded;
    } catch (err) {
        throw err;
    }
}

//The master decoder - will call the correct function based on the packet type
//Gets called multiple times depending on if the payload still has more packets to decode
function decode_packets(msg, rinfo, offset, timestamp, decoded) {
    if (offset < msg.length) {
        //console.log('First Byte: ' + msg.readUInt32BE(offset + 0).toString(2));
        var packet = {
            IP: rinfo.address,
            packet_length: msg.length
        };
        packet.padding = msg[offset + 0] & 32;   //padding is 1 or 0 00100000
        packet.type = msg.readUInt8(offset + 1);
        packet.report_count = msg.readUInt8(offset) & 31;   //bits 3 - 7
        packet.packet_length = msg.readUInt16BE(offset + 2);

        if (decoders[packet.type]) {
            try {
                packet.data = decoders[packet.type](msg, offset);    
                //Ignore packets that couldn't be decoded
                if (packet.data) {
                    var Packet = mongoose.model('Packet');
                    var mongoPacket = new Packet();
                    mongoPacket.device.IP_ADDRESS = packet.IP;
                    mongoPacket.metadata.TYPE = packet.type;
                    mongoPacket.metadata.LENGTH = packet.packet_length;
                    mongoPacket.data = packet.data;
                    mongoPacket.timestamp = timestamp;
                    mongoPacket.save(function(err, packet) {
                        console.log('\tDone inserting ' + packet._id + ' into mongodb.');
                    });

                    //if (packet.type === 204 && packet.data.subtype === 5 || packet.data.subtype === 4)    //only print sender/receiver reports
                    if (packet.type === 203)
                        console.log(JSON.stringify(packet, undefined, 2));

                    //TODO: can make this run asynchronously
                    decoded.push(mongoPacket);
                } else {
                    console.log('\tError: Packet could not be decoded. ');
                }
            } catch (err) {
                console.log('Error decoding packet: ' + err);
                console.log(packet.data);
                //UNCOMMENT THIS LINE TO BREAK THE DECODER UPON A FAILED DECODING
                //throw err;
            }
        } else {
            console.log('\tError: Unknown packet type: ' + packet.type);
        }

        decode_packets(msg, rinfo, offset + 4 + packet.packet_length * 4, timestamp, decoded);
    } else {
        console.log('[DECODER] decoding UDP message complete.');
    }
} 

//Decode SR type packet
function decode_200(msg, offset) {

    //Reads a report block, pass in an offset in bytes
    function decode_report_block(msg, offset) {
        var report_block = {};
        report_block.ssrc = msg.readUInt32BE(offset);
        report_block.fraction_lost = msg.readUInt8(offset+4);
        report_block.cumulative_lost = msg.readUInt32BE(offset+4) & 0x00FFFFFF;
        report_block.highest_sequence_received = msg.readUInt32BE(offset + 8);
        report_block.interarrival_jitter = msg.readUInt32BE(offset + 12);
        report_block.last_sr = msg.readUInt32BE(offset + 16);
        report_block.delay_since_last_sr = msg.readUInt32BE(offset + 20);
        return report_block;
    }

    console.log('[DECODER] - Found 200 - Sender Report');
    var data = {};
    data.length = msg.readUInt16BE(offset + 2);
    data.ssrc = msg.readUInt32BE(offset + 4);
    data.NTP_MSW = msg.readUInt32BE(offset + 8);
    data.NTP_LSW = msg.readUInt32BE(offset + 12);
    data.RTP_timestamp = msg.readUInt32BE(offset + 16);
    data.sender_packet_count = msg.readUInt32BE(offset + 20);
    data.sender_octet_count = msg.readUInt32BE(offset + 24);
    data.report_blocks = [];

    var num_report_blocks = (data.length - 6) / 6;
    for (var i = 0; i < num_report_blocks; i++) {
        //there are 6 32-bit words per report block; i.e. 6 x 4 bytes
        data.report_blocks.push(decode_report_block(msg, offset + 28 + (i * 24)));
    }
    return data;
}

//Decode Receiver Report type packet
function decode_201(msg, offset) {
    function decode_report_block(msg, offset) {
        var report_block = {};
        report_block.ssrc = msg.readUInt32BE(offset);
        report_block.fraction_lost = msg.readUInt8(offset+4);
        report_block.cumulative_lost = msg.readUInt32BE(offset+4) & 0x00FFFFFF;
        report_block.highest_sequence_received = msg.readUInt32BE(offset + 8);
        report_block.interarrival_jitter = msg.readUInt32BE(offset + 12);
        report_block.last_sr = msg.readUInt32BE(offset + 16);
        report_block.delay_since_last_sr = msg.readUInt32BE(offset + 20);
        return report_block;
    }

    console.log('[DECODER] - Found 201 - Receiver Report');
    var data = {};
    data.length = msg.readUInt16BE(offset + 2);
    data.ssrc = msg.readUInt32BE(offset + 4);
    data.report_blocks = [];

    var num_report_blocks = (data.length - 6) / 6;
    for (var i = 0; i < num_report_blocks; i++) {
        //there are 6 32-bit words per report block; i.e. 6 x 4 bytes
        data.report_blocks.push(decode_report_block(msg, offset + 8 + (i * 24)));
    }
    return data;
}

//Decode Source Description type packet
// END      end of SDES list                    0
// CNAME    canonical name                      1
// NAME     user name                           2
// EMAIL    user's electronic mail address      3
// PHONE    user's phone number                 4
// LOC      geographic user location            5
// TOOL     name of application or tool         6
// NOTE     notice about the source             7
// PRIV     private extensions                  8
function decode_202(msg, offset) {
    function decode_sdes_item(msg, offset, type, length) {
        var sdes_item = {};
        sdes_item.type = type;
        sdes_item.length = length;
        sdes_item.value = msg.toString('utf8', offset, offset + length);
        return sdes_item;
    }

    console.log('[DECODER] - Found 202 - Source Description');
    var data = {
        length: msg.readUInt16BE(offset + 2)
    };
    var source_count = msg.readUInt8(offset) & 31;  //Number of chunks
    var chunks = [];
    var sdes_item_offset = offset + 8;

    //Read through SDES Items, which are variable in length
    for (var i = 0; i < source_count; i++) {
        var chunk = {
            ssrc: msg.readUInt32BE(offset + 4),
            sdes_items: []
        };

        while (sdes_item_offset < offset + (4 + data.length * 4)) {
            var sdes_item_type = msg.readUInt8(sdes_item_offset);
            if (sdes_item_type === 0) { //terminal sdes_item_type
                offset = findNextWord(sdes_item_offset);
                break;
            } else {
                var sdes_item_length = msg.readUInt8(sdes_item_offset + 1);
                chunk.sdes_items.push(decode_sdes_item(msg, sdes_item_offset + 2, sdes_item_type, sdes_item_length));
                sdes_item_offset += sdes_item_length + 2;   //the length field doesn't include the 2 byte header
            }
        }

        chunks.push(chunk);
    }

    data.chunks = chunks;
    return data;
}

//Decode Bye Description type packet
function decode_203(msg, offset) {
    console.log('[DECODER] - Found 203 - Goodbye');
    var data = {};
    data.length = msg.readUInt16BE(offset + 2);
    data.src_count = msg.readUInt8(offset) & 31;
    data.ssrc = [];
    for (var i = 0; i < data.src_count; i++) {
        var ssrc_offset = offset + (4 * (i + 1));
        data.ssrc.push(msg.readUInt32BE(ssrc_offset));
    }
    console.log(data);
    //extra optional reason included
    if (data.length > data.src_count) {
        var len_start = offset + 4 + (data.src_count * 4);
        console.log('len start: ' + len_start);
        var reason_length = msg.readUInt8(len_start);
        console.log('reason length: ' + reason_length);
        data.bye_reason = msg.toString('utf8', len_start + 1, len_start + 1 + reason_length);
    } else {
        data.bye_reason = '';
    }

    return data;
}

//Decode App type packet - This is Avaya Specific
//Follows the packet schema for keys, start = starting byte, size: # of bytes
//note Keep these in order of bit_mask since it's used as a counter
var avaya_bit_map = {
    //Field Name: RTP Packet Count
    MID_RTP_PACKET_COUNT: {
        start: 20,
        size: 4,
        bit_mask: 0
    },
    //Field Name: RTP Octet Count
    MID_RTP_OCTET_COUNT: {
        start: 24,
        size: 4,
        bit_mask: 1
    },
    //Field Name: RTCP Round Trip Time
    MID_RTCP_RTT: {
        start: 28,
        size: 2,
        bit_mask: 2
    },
    //Field Name: Jitter Buffer Delay
    MID_JITTER_BUFFER_DELAY: {
        start: 30,
        size: 2,
        bit_mask: 3
    },
    //Field Name: Largest Sequence Jump
    MID_LARGEST_SEQ_JUMP: {
        start: 32,
        size: 1,
        bit_mask: 4
    },
    //Field Name: Largest Sequence Fall
    MID_LARGEST_SEQ_FALL: {
        start: 33,
        size: 1,
        bit_mask: 5
    },
    //Field Name: RSVP Status
    MID_RSVP_RECEIVER_STATUS: {
        start: 34,
        size: 1,
        bit_mask: 6
    },
    //Field Name: Maximum Jitter
    MID_MAX_JITTER: {
        start: 35,
        size: 4,
        bit_mask: 7
    },
    //Field Name: Jitter Buffer Underruns
    MID_JITTER_BUFFER_UNDERRUNS: {
        start: 39,
        size: 1,
        bit_mask: 8
    },
    //Field Name: Jitter Buffer Overruns
    MID_JITTER_BUFFER_OVERRUNS: {
        start: 40,
        size: 1,
        bit_mask: 9
    },
    //Field Name: Sequence Jump Instances
    MID_SEQ_JUMP_INSTANCES: {
        start: 41,
        size: 4,
        bit_mask: 10
    },
    //Field Name: Sequence Fall Instances
    MID_SEQ_FALL_INSTANCES: {
        start: 45,
        size: 4,
        bit_mask: 11
    },
    //Field Name: Echo Tail Length
    MID_ECHO_TAIL_LENGTH: {
        start: 49,
        size: 1,
        bit_mask: 12
    },
    //Field Name: Remote IP Address
    MID_IP_ADDR: {
        start: 50,
        size: 4,
        IP: true,
        bit_mask: 13
    },
    //Field Name: Remote IP Address & RTCP Port
    MID_ADDR_PORT: {
        start: 54,
        size: 2,
        bit_mask: 13
    },
    //Field Name: RTP Payload Type
    MID_PAYLOAD_TYPE: {
        start: 56,
        size: 1,
        bit_mask: 14
    },
    //Field Name: Frame Size
    MID_FRAME_SIZE: {
        start: 57,
        size: 1,
        bit_mask: 15
    },
    //Field Name: Time To Live
    MID_RTP_TTL: {
        start: 58,
        size: 1,
        bit_mask: 16
    },
    //Field Name: DiffServ Code Point
    MID_RTP_DSCP: {
        start: 59,
        size: 1,
        bit_mask: 17
    },
    //Field Name: 802.1D
    MID_RTP_8021D: {
        start: 60,
        size: 2,
        bit_mask: 18
    },
    //Field Name: Media Encryption
    MID_MEDIA_ENCYPTION: {
        start: 52,
        size: 1,
        bit_mask: 19
    },
    //Field Name: Silence Suppression
    MID_SILENCE_SUPPRESSION: {
        start: 63,
        size: 1,
        bit_mask: 20
    },
    //Field Name: Acoustic Echo Cancellation
    MID_ECHO_CANCELLATION: {
        start: 64,
        size: 1,
        bit_mask: 21
    },
    //Field Name: Incoming Stream RTP Source Port
    MID_IN_RTP_SRC_PORT: {
        start: 65,
        size: 2,
        bit_mask: 22
    },
    //Field Name: Incoming Stream RTP Destination Port
    MID_IN_RTP_DEST_PORT: {
        start: 67,
        size: 2,
        bit_mask: 23
    }
};

//try to read IPv4 Traceroute Information
var avaya_subtype_5 = {
    MID_GATEKEEPER_ADDR: {
        size: 4,
        bit_mask: 0,
        IP: true
    }, 
    MID_TRACE_ROUTE_HOPCOUNT: {
        size: 1,
        bit_mask: 1
    }, 
    MID_TRACE_ROUTE_PERHOP: {
        size: 6,
        bit_mask: 2
    },
    MID_OUT_RTP_SRC_PORT: {
        size: 2,
        bit_mask: 3
    }, 
    MID_OUT_RTP_DEST_PORT: {
        size: 2,
        bit_mask: 4
    },
    MID_GATEWAY_ADDR: {
        size: 4,
        bit_mask: 5
    }, 
    MID_SUBNET_MASK: {
        size: 4,
        bit_mask: 6
    },
    MID_GATEKEEPER_ADDR6: {
        size: 16,
        bit_mask: 7
    }, 
    MID_TRACE_ROUTE6_PERHOP: {
        size: 18,
        bit_mask: 8
    },
    MID_GATEWAY_ADDR6: {
        size: 16,
        bit_mask: 9
    }, 
    MID_PREFIX_LENGTH: {
        size: 1,
        bit_mask: 10
    }
};

/*
* NOTE: avaya metric mask is determinative of the values to go through
*/
function decode_204(msg, offset) {
    
    //Follows the RTCP spec
    var data = {
        subtype: msg.readUInt8(offset) & 31,
        length: msg.readUInt16BE(offset + 2),
        qos: {
            avaya:{}
        }
    };
    console.log('[DECODER] Found 204 - Application-Defined Subtype [%s]', data.subtype);

    data.ssrc = msg.readUInt32BE(offset + 4);
    data.name = msg.toString('ascii', offset + 8, offset + 12);
    var ptr;

    //Only try to decode App specific packets with a known name
    if (data.name === '-AV-' && data.subtype === 4) {
        data.ssrc_inc_rtp_stream = msg.readUInt32BE(offset + 12);
        data.metric_mask = msg.readUInt32BE(offset + 16);
        ptr = offset + 20;   //start at first value
        for (var key in avaya_bit_map) {
            if (getEnabled(data.metric_mask, avaya_bit_map[key].bit_mask)) {
                //console.log('%s is enabled', key);
                if (avaya_bit_map[key].size === 1) {
                data.qos.avaya[key] = msg.readUInt8(ptr);
                } else if (avaya_bit_map[key].size === 2) {
                    data.qos.avaya[key] = msg.readUInt16BE(ptr);
                } else if (avaya_bit_map[key].IP === true) {
                    data.qos.avaya[key] = getIPv4Address(msg.readUInt32BE(ptr));
                } else if (avaya_bit_map[key].size === 4) {
                    data.qos.avaya[key] = msg.readUInt32BE(ptr);
                }
                ptr += avaya_bit_map[key].size;
            }
        }
    } else if (data.name === '-AV-' && data.subtype === 5) {
        data.ssrc_inc_rtp_stream = msg.readUInt32BE(offset + 12);
        data.metric_mask = msg.readUInt32BE(offset + 16);
        console.log('metric mask for 204 subtype 5: ', data.metric_mask.toString(2));
        data.routing = {
            avaya: {}
        };

        ptr = offset + 20;
        //Compute routing information
        for (var key in avaya_subtype_5) {
            if (getEnabled(data.metric_mask, avaya_subtype_5[key].bit_mask)) {
                //console.log('%s is enabled', key);
                if (avaya_subtype_5[key].size === 1) {
                    data.routing.avaya[key] = msg.readUInt8(ptr);
                    ptr += avaya_subtype_5[key].size;
                } else if (avaya_subtype_5[key].size === 2) {
                    data.routing.avaya[key] = msg.readUInt16BE(ptr);
                    ptr += avaya_subtype_5[key].size;
                } else if (avaya_subtype_5[key].IP === true) {
                    data.routing.avaya[key] = getIPv4Address(msg.readUInt32BE(ptr));
                    ptr += avaya_subtype_5[key].size;
                } else if (avaya_subtype_5[key].size === 4) {
                    data.routing.avaya[key] = msg.readUInt32BE(ptr);
                    ptr += avaya_subtype_5[key].size;
                } else if (avaya_subtype_5[key].size === 6 && key == 'MID_TRACE_ROUTE_PERHOP') {
                    if (getEnabled(data.metric_mask, avaya_subtype_5.MID_TRACE_ROUTE_HOPCOUNT.bit_mask)) {
                        data.routing.avaya.MID_TRACE_ROUTE_PERHOP = [];
                        for (var i = 0; i < data.routing.avaya.MID_TRACE_ROUTE_HOPCOUNT; i++) {
                            var hopInfo = {};
                            hopInfo.hop = i;
                            hopInfo.IP_ADDRESS = getIPv4Address(msg.readUInt32BE(ptr));
                            ptr += 4;
                            hopInfo.RTT_of_hop = msg.readUInt16BE(ptr);
                            ptr += 2;
                            data.routing.avaya.MID_TRACE_ROUTE_PERHOP.push(hopInfo);
                        }
                    }
                } else {
                    ptr += avaya_subtype_5[key].size;
                }
            }
        }

    } else {
        console.log('\tIgnoring 204 packet with name: [%s] and subtype [%d].  Don\'t know how to decode!', data.name, data.subtype);
        return undefined;
    }
    return data;
}

//Avaya specific function to tell you if a field is enabled based on the metric mask
function getEnabled(metric_mask, bit_pos) {
    return ((metric_mask >>> (31 - bit_pos)) & 1) === 1 ? true : false;
}

//Returns a string based on a 32 bit int
function getIPv4Address(int32) {
    var ipv4 = '';
    ipv4 =  ((int32 & 0xFF000000) >> 24).toString() + '.' + 
            ((int32 & 0x00FF0000) >> 16).toString() + '.' + 
            ((int32 & 0x0000FF00) >> 8).toString() + '.' + 
            (int32 & 0x000000FF).toString();
    return ipv4;
}

function findNextWord(octet) {
    if (octet % 4 === 0) {
        return octet;
    } else {
        return Math.floor(octet / 4) * 4 + 4;
    }
}

var Decoder = function () {

    if (Decoder.prototype._singletonInstance) {
        return Decoder.prototype._singletonInstance;
    }

    Decoder.prototype._singletonInstance = this;

    var msgCount = 0;
    var sessionId = makeid();
    var captureOn = false;

    this.setCapture = function(capture) {
        if (captureOn === false && capture === true) {  //reset sessionId, message count
            sessionId = makeid();
            msgCount = 0;
        }
        captureOn = capture;

    };

    this.getCapture = function() {
        return {
            sessionId: sessionId,
            captureOn: captureOn,
            msgCount: msgCount
        }
    };

    this.decode = function(msg, rinfo) {
        var filename = 'rtcp_packets_' + sessionId + '_' + msgCount.toString() + '_' + new Date().getTime();
        var decoded = decode(msg, rinfo, filename, captureOn);
        msgCount++; //keeps track of number of udp received
        return decoded;
    };
};

module.exports = Decoder;