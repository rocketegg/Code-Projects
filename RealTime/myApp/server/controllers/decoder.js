//Author: Al Ho 2/22/2014
'use strict';
var util = require('util'),
    radius = require('radius'),
    fs = require('fs'),
    mongoose = require('mongoose');

var secret = 'radius_secret';
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
function decode (msg, rinfo) {
    try {
        decode_packets(msg, rinfo, 0);
    } catch (err) {
        throw err;
    }
}

//The master decoder - will call the correct function based on the packet type
//Gets called multiple times depending on if the payload still has more packets to decode
function decode_packets(msg, rinfo, offset) {
    function writeToFile(msg) {
        var filename = 'rtcp_packets_' + makeid();
        console.log('---Writing byte stream to' + filename);
        var wstream = fs.createWriteStream('./packets/' + filename);
        wstream.write(msg);
        wstream.end();
        console.log('---Done.');
    }

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

        //UNCOMMENT THIS TO WRITE SOME PACKETS TO THE packets dir
        //writeToFile(msg);

        if (decoders[packet.type]) {
            packet.data = decoders[packet.type](msg, offset);
            var Packet = mongoose.model('Packet');
            var mongoPacket = new Packet();
            mongoPacket.device.IP_ADDRESS = packet.IP;
            mongoPacket.metadata.TYPE = packet.type;
            mongoPacket.metadata.LENGTH = packet.packet_length;
            mongoPacket.data = packet.data;
            mongoPacket.save(function(err, packet) {
                console.log("\tDone inserting " + packet._id + " into mongodb.");
            });

            if (packet.type === 200)
                console.log(JSON.stringify(packet, undefined, 2));
        } else {
            console.log('\tError: Unknown packet type: ' + packet.type);
        }

        decode_packets(msg, rinfo, offset + 4 + packet.packet_length * 4);
    } else {
        console.log('\t[DECODER] decoding packet done.');
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
    console.log('[DECODER] - Found 201 - Receiver Report');
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
}

//Decode App type packet - This is Avaya Specific
function decode_204(msg, offset) {
    console.log('[DECODER] Found 204 - Application-Defined');
}

function findNextWord(octet) {
    if (octet % 4 == 0) {
        return octet;
    } else {
        return Math.floor(octet / 4) * 4 + 4;
    }
}

var DecoderUtil = function () {
    return {
        decode: function(msg, rinfo) {
            return decode(msg, rinfo);
        }
    };
};

module.exports = DecoderUtil;