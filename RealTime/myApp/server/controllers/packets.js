'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Packet = mongoose.model('Packet'),
    _ = require('lodash'),
    dgram = require('dgram'),
    encoder = require('./encoder.js'),
    CronJob = require('cron').CronJob,
    util = require('util');


/**
 * Find packet by id
 */
exports.packet = function(req, res, next, id) {
    Packet.load(id, function(err, packet) {
        if (err) return next(err);
        if (!packet) return next(new Error('Failed to load packet ' + id));
        req.packet = packet;
        next();
    });
};

/**
 * Create an packet
 */
exports.create = function(req, res) {
    var packet = new Packet(req.body);

    //BACKFILL MONGO WITH RANDOM DATA
    var score1 = Math.floor(Math.random() * 5);
    var score2 = Math.floor(Math.random() * 10);

    packet.data = [{
        score1: score1,
        score2: score2
    }];

    packet.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                packet: packet
            });
        } else {
            res.jsonp(packet);
        }
    });
};

exports.refresh = function(req, res) {
    res.send('200');
};

/**
 * Update an packet
 */
exports.update = function(req, res) {
    var packet = req.packet;

    packet = _.extend(packet, req.body);

    packet.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                packet: packet
            });
        } else {
            res.jsonp(packet);
        }
    });
};

/**
 * Delete an packet
 */
exports.destroy = function(req, res) {
    var packet = req.packet;

    packet.remove(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                packet: packet
            });
        } else {
            res.jsonp(packet);
        }
    });
};

/**
 * Show an packet
 */
exports.show = function(req, res) {
    res.jsonp(req.packet);
};

/**
 * List of packets
 */
exports.all = function(req, res) {
    Packet.find().sort('-created').exec(function(err, packets) {
        if (err) {
            res.render('error', {
                status: 500
            });
        } else {
            res.jsonp(packets);
        }
    });
};

var rtcpjob;

exports.start = function(req, res) {
    console.log('Express - starting up sending RTCP packets');
    console.log(req.body);

    //Wrapper class to send some bytes via random rtcp packets written to a file

    var _encoder = new encoder();
    var client = dgram.createSocket('udp4');

    var interval = req.body.interval;
    var ip = req.body.ip;
    var iterations = req.body.iterations;
    var port = req.body.port;

    if (rtcpjob) {
        rtcpjob.stop();
    }
    rtcpjob = new CronJob({
      cronTime: '*/' + interval + ' * * * * *',
      //Runs every 5 seconds
      onTick: function() {
        for (var i = 0; i < iterations; i++) {
                _encoder.encodeRandomPacket('./', function (err, data) {
                console.log('Streaming @ [%s]', new Date().getTime());
                console.log(data);
                client.send(data, 0, data.length, port, ip, function(err, bytes) {

                });
            });
        }
      },
      start: false,
      timeZone: "America/Los_Angeles"
    });

    console.log('Starting up cron job to stream random packets');
    rtcpjob.start();
    res.jsonp(util.inspect(rtcpjob));

};

exports.stop = function(req, res) {
    console.log('Express - stop sending RTCP packets');
    console.log(req.body);

    rtcpjob.stop();
    console.log(rtcpjob);
    res.jsonp(util.inspect(rtcpjob));
};

exports.checkjobstatus = function(req, res) {
    res.jsonp({
        running: rtcpjob ? rtcpjob.running : 'N/A'
    });
};

exports.slice = function(req, res) {
    // console.log('Express - getting RTCP packet slice');
    // console.log(req.query);

    var startTime = req.query.startTime;
    var endTime = req.query.endTime;
    var density = req.query.density;

    var Reduce = mongoose.model('Reduce');

    Reduce.slice(startTime, endTime, density, function(err, packets) {
        if (err) throw err;

        res.jsonp(packets);
    });
};
