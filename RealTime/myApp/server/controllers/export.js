'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Device = mongoose.model('Device'),
    json2csv = require('json2csv'),
    fs = require('fs'),
    _ = require('lodash'),
    tar = require('tar'),
    fstream = require('fstream'),
    temp = require('temp');

temp.track();

//Export all packet data for a call
exports.exportcall = function(req, res) {
    var call = req.call;
    var result = [];
    call.metrics.from.intervals.forEach(function(datapoint) {
        result.push(_.pick(datapoint, 
                        'timestamp', 
                        'rtp_total_packet_count', 
                        'rtp_interval_packets', 
                        'rtp_total_packet_loss', 
                        'rtp_interval_packet_loss',
                        'rtp_total_packet_out_of_order',
                        'rtp_interval_packets_out_of_order',
                        'jitter_buffer_delay')
                    );
    });

    json2csv({data: call.metrics.from.intervals, fields: [
                        'timestamp', 
                        'rtp_total_packet_count', 
                        'rtp_interval_packets', 
                        'rtp_total_packet_loss', 
                        'rtp_interval_packet_loss',
                        'rtp_total_packet_out_of_order',
                        'rtp_interval_packets_out_of_order',
                        'jitter_buffer_delay']}, 
        function(err, csv) {
            if (err) {
                console.log(err);
                throw err;
            }
            var filename = 'call_' + call._id.toString() + '.csv';
            fs.writeFile(filename, csv, function(err) {
                if (err) throw err;
                res.attachment();
                res.sendfile(filename);
            });
        }
    );
};

//Exports last hour data for a device
exports.exportdevice = function(req, res) {

};

//Exports packets given a query
exports.exportpackets = function(req, res) {
    var sessionId = req.query.sessionId;
    if (sessionId) {
        console.log('Beginning tarring of packets in session: %s', sessionId);
        var tarFile = sessionId + '.tar';
        var out = temp.createWriteStream();
        var __dirname = 'packets/' + sessionId;
        var reader = fstream.Reader({ 
                path: __dirname,
                type: 'Directory'
            })
            .pipe(tar.Pack({ noProprietary: true }))
            .pipe(out);

        out.on('end', function() {
            console.log('end');
        })

        out.on('finish', function() {
            console.log('File tar %s done creating.', tarFile);
            res.download(out.path, tarFile);
        });
    } else {
        res.send(500, {
            err: 'No sessionId specified.'
        });
    }
};

//Exports data posted in the req.body
exports.exportobject = function(req, res) {
    var obj = req.body;

    if (obj) {
        var data = flattenArray(obj);
        var _fields = Object.keys(data[0]);
        json2csv({data: data, fields: _fields}, 
            function(err, csv) {
                if (err) {
                    console.log(err);
                    throw err;
                }
                var filename = 'data.csv';
                console.log(csv);
                fs.writeFile(filename, csv, function(err) {
                    if (err) throw err;
                    res.sendfile(filename);
                });
            }
        );
    } else {
        res.jsonp({});
    }
};

function flattenArray(array) {
    var copy = [];
    for (var i = 0; i < array.length; i++) {
        var j = flatten(array[i]);
        console.log("J is:");
        console.log(j);
        copy.push(flatten(array[i]));
    }
    return copy;
}

function flatten(idx) {
    var flattened = {};
    for (var key in idx) {
        console.log(idx[key]);
        if (idx[key] instanceof Object) {
            var _flattened = flatten(idx[key]);
            for (var key2 in _flattened) {
                flattened[key + '.' + key2] = _flattened[key2];
            }
        } else {
            flattened[key] = idx[key];
        }
    }
    console.log("returning");
    return flattened;
}