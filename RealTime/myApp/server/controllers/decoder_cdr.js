//Author: Al Ho 2/22/2014
'use strict';
var fs = require('fs'),
    mongoose = require('mongoose');

var decoders = {
    105: decode_unformatted,
    123: decode_enhanced_unformatted
};

//Entry method
function decode (buffer) {
    try {
        var timestamp = new Date().getTime();
        console.log('[DECODE]: Decoding CDR message with timestamp: %s.', timestamp);
        var decoded = buffer.toString('ascii');

        //If statement depending on the type of CDR format 
        var _decoder = decoders[buffer.length];
        if (_decoder) {
            console.log(decoded);
            return _decoder(decoded);
        } else {
            console.log('[CDR]: incoming CDR data of unknown length');
            return undefined;
        }
    } catch (err) {
        throw err;
    }
}

var avaya_unformatted_map = {
    TIME_OF_DAY_HOURS: {
        start: 1,
        size: 2
    }, 
    TIME_OF_DAY_MINUTES: {
        start: 3,
        size: 2
    },
    DURATION_HOURS: {
        start: 5,
        size: 1
    },
    DURATION_MINUTES: {
        start: 6,
        size: 2
    },
    DURATION_TENTHS_OF_MINUTES: {
        start: 8,
        size: 1
    },
    CONDITION_CODE: {
        start: 9,
        size: 1
    },
    ACCESS_CODE_DIALED: {
        start: 10,
        size: 4
    },
    ACCESS_CODE_USED: {
        start: 14,
        size: 4
    },
    DIALED_NUMBER: {
        start: 18,
        size: 15
    },
    CALLING_NUMBER: {
        start: 33,
        size: 10
    }
    //.. MORE
};

function decode_unformatted (string) {
    var decoded = {};
    for (var key in avaya_unformatted_map) {
        var _str = string.substring(avaya_unformatted_map[key].start, avaya_unformatted_map[key].start + avaya_unformatted_map[key].size);
        decoded[key] = _str;
    }
    return decoded;
}

function decode_enhanced_unformatted (string) {
    return decode_unformatted(string);
}

var DecoderCDR = function () {

    if (DecoderCDR.prototype._singletonInstance) {
        return DecoderCDR.prototype._singletonInstance;
    }

    DecoderCDR.prototype._singletonInstance = this;

    //msg is of type Buffer
    this.decode = function(data) {
        var decoded = decode(data);
        return decoded;
    };
};

module.exports = DecoderCDR;