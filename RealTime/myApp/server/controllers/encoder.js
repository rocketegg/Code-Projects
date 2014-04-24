//Can encode a random RTCP packet
//Author: Al Ho 2/22/2014
'use strict';
var fs = require('fs');



function encodeRandomPacket(directory, cb) {
    function getRandomFile(files) {
        var index = Math.floor(Math.random() * files.length);
        return files[index];
    }

    fs.readdir(directory, function(err, files) { 
        var rtcpFiles = [];
        files.forEach(function(file) {
            if (file.indexOf('rtcp_packets_') > -1) {
                rtcpFiles.push(file);
            }
        });
        var randFile = getRandomFile(rtcpFiles);
        console.log('\nReading file: ' + randFile);
        fs.readFile(directory + randFile, function (err, data) {
            cb(err, data);
        });
    });
}

var EncoderUtil = function () {
    return {
        //returns a buffer of a random file read from directory
        //takes a directory and looks for files with the pattern
        //rtcp_packets_XXXXX, where XXXXX is a random set of strings
        encodeRandomPacket: function(directory, cb) {
            return encodeRandomPacket(directory, cb);
        }
    };
};

module.exports = EncoderUtil;