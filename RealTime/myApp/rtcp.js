'use strict';

var mean = require('meanio'),
    fs = require('fs'),
	dgram = require('dgram'),
	decoder = require('./server/controllers/decoder.js'),
	Aggregator = require ('./server/controllers/util/Aggregator.js'),
	CronJob = require('cron').CronJob,
    DecoderCache = require('./server/controllers/util/DecoderCache.js'),
    DeviceCache = require('./server/controllers/util/DeviceCache.js'),
    Sensor = require('./server/controllers/util/Sensor.js'),
    Cache = require('./server/controllers/util/Cache.js'),
    PacketWriter = require('./server/controllers/util/PacketWriter.js'),
    async = require('async'),
    appPath = process.cwd(),
    mongoose = require('mongoose');

var config = require('./server/config/config');

/**
* The RTCP Collector module - currently not stateless
* but should be moved as such so we can take advantage of multiple cores
* Author: Al Ho
* Updated: 8/4/2014
*/
var _rtcpCollector = (function(dbconfig) {
    if (_rtcpCollector.prototype._singletonInstance) {
        return _rtcpCollector.prototype._singletonInstance;
    }

    _rtcpCollector.prototype._singletonInstance = this;

    function bootstrapModels() {
        var models_path = appPath + '/server/models';
        var walk = function(path) {
            fs.readdirSync(path).forEach(function(file) {
                var newPath = path + '/' + file;
                var stat = fs.statSync(newPath);
                if (stat.isFile()) {
                    if (/(.*)\.(js$|coffee$)/.test(file)) {
                        require(newPath);
                    }
                } else if (stat.isDirectory()) {
                    walk(newPath);
                }
            });
        };
        walk(models_path);
    }

    //init
    var db = mongoose.connect(dbconfig);
    bootstrapModels();

    //Local dependencies / variables
    var _decoder = new decoder();
    var _decoderCache = new DecoderCache(12);
    var _sensor = new Sensor();
    var _callCache = new Cache();
    var _packetWriter = new PacketWriter();
    var _deviceCache = new DeviceCache();

    function start() {
    }

    function stop() {
    }

    function process(msg, rinfo) {
        console.log('[RTCP Collector] Received a message from ' + rinfo.address + ':' + rinfo.port + ' @ [%s] of size [%d] bytes.', new Date(), msg.length);
        var buffer = new Buffer(msg);
        var decoded = _decoder.decode(buffer, rinfo);  //decoded is a bundle of decoded packets that eventually will get saved to mongodb (at some point)
        if (_packetWriter.getCaptureOn()) {
            async.parallel([
              function(callback) {
                _packetWriter.write(buffer, rinfo);
              }], function(err, results) {
                //done;
            });
        }
        //1 - register device
        if (!_decoderCache.hasKey(rinfo.address)) {
            var Device = mongoose.model('Device');
            Device.registerIfNecessary(rinfo.address);
        }

        //2 - track calls
        _sensor.trackCall(_decoderCache.filterAndStripByType(rinfo.address, 204, 4), decoded,

          //This function called when call is starting or already started, callStart is the call object
          function (err, callStart) {
            //_callCache.setItem(callStart._id, callStart);
          },

          //This function called when call was started and call ends, callEnd is the call object
          function (err, callEnd) {
            //_callCache.clearItem(callEnd._id);
            //console.log('Call ended: ', callEnd._id);        
          }
        );

        //3 - add to decoder cache
        _decoderCache.pushPackets(rinfo.address, decoded);

        //4 - backfill device info, this should only be done every so often (202 is an SDES packet)
        var idx = decoded.map(function(packet) { return packet.metadata.TYPE; }).indexOf(202);
        if (idx > -1) {
            _deviceCache.updateMetadata(rinfo.address, decoded[idx]);
        }
    }

    return {
        start: function(id) {
            console.log('[RTCP Collector] Starting up. [%s]', id);
            start(id);
        },

        process: function(msg, rinfo) {
            process(msg, rinfo);
        },

        stop: function() {
            stop();
        }
    }
});

module.exports = _rtcpCollector;
