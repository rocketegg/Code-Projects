//Author: Al Ho 2/22/2014
'use strict';
var util = require('util'),
    radius = require('radius'),
    fs = require('fs'),
    mongoose = require('mongoose');

var secret = 'radius_secret';
//RTCP_PT_SR = 200
//RTCP_PT_RR = 201
//RTCP_PT_SDES = 202
//RTCP_PT_BYE = 203
//RTCP_PT_APP = 204
var decoders = {
    '200': decode_200,
}

function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

//Entry method
function decode (msg, rinfo) {
    function writeToFile(msg) {
        var filename = 'rtcp_packets_' + makeid();
        console.log('---Writing byte stream to' + filename);
        var wstream = fs.createWriteStream('./packets/' + filename);
        wstream.write(msg);
        wstream.end();
        console.log('---Done.');
    }
    var result = [];
    var time = new Date();
    console.log('In decoder.js:  [%s] Trying to decode byte stream...', time);
    var packet = {};

    packet.IP = rinfo.address;

    packet.packet_length = msg.length;
    // console.log('First Byte: ' + msg.readUInt32BE(0).toString(2));
    // packet.padding = msg[0] & 32;   //padding is 1 or 0 00100000
    packet.type = msg.readUInt8(1);

    //UNCOMMENT THIS TO WRITE SOME PACKETS TO THE packets dir
    //writeToFile(msg);

    // if (decoders[packet.type]) {
    //     packet.data = decoders[packet.type](msg);
    // } else {
    //     console.log('\tError: Unknown packet type: ' + packet.type);
    // }

    var Packet = mongoose.model('Packet');
    var mongoPacket = new Packet();
    mongoPacket.device.IP_ADDRESS = packet.IP;
    mongoPacket.metadata.TYPE = packet.type;
    mongoPacket.metadata.LENGTH = packet.packet_length;

    mongoPacket.save(function(err, packet) {
        console.log("\tDone inserting " + packet._id + " into mongodb.");
    });

    //console.log(JSON.stringify(packet, undefined, 2));

    //console.log("data: " + msg);
    //console.log(msg);

    return result;
}



//Decode SR type packet
function decode_200(msg) {
    console.log('\tFound 200 - Sender Report');
    var data = {};
    data.length = msg.readUInt16BE(2);
    data.ssrc = msg.readUInt32BE(4);
    data.NTP_MSW = msg.readUInt32BE(8);
    data.NTP_LSW = msg.readUInt32LE(12);
    data.RTP_timestamp = msg.readUInt32BE(16);
    data.sender_packet_count = msg.readUInt32BE(20);
    data.sender_octet_count = msg.readUInt32BE(24);
    data.report_blocks = [];

    var num_report_blocks = (data.length - 6) / 6;
    for (var i = 0; i < num_report_blocks; i++) {
        //there are 6 32-bit words per report block; i.e. 6 x 4 bytes
        data.report_blocks.push(decode_report_block(msg, 28 + (i * 24)));
    }
    return data;

    //Reads a report block, pass in an offset in bytes
    function decode_report_block(msg, offset) {
        var report_block = {};
        report_block.ssrc = msg.readUInt32BE(offset);
        report_block.fraction_lost = msg.readUInt8(offset+4+1);
        report_block.cumulative_lost = msg.readUInt8(offset+4+2);
        report_block.highest_sequence_received = msg.readUInt32BE(8);
        report_block.last_sr = msg.readUInt32BE(12);
        report_block.delay_since_last_sr = msg.readUInt32BE(16);
        return report_block;
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