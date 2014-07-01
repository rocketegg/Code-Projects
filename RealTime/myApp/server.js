'use strict';
/**
 *  Mean container for dependency injection
 */
var mean = require('meanio'),
	dgram = require('dgram'),
	decoder = require('./server/controllers/decoder.js'),
	Aggregator = require ('./server/controllers/util/Aggregator.js'),
	Purger = require ('./server/controllers/util/Purger.js'),
	CronJob = require('cron').CronJob,
  DecoderCache = require('./server/controllers/util/DecoderCache.js'),
  Sensor = require('./server/controllers/util/Sensor.js'),
  Cache = require('./server/controllers/util/Cache.js'),
  PacketWriter = require('./server/controllers/util/PacketWriter.js'),
  async = require('async');

mean.app('RTCP Collector Prototype',{});

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    passport = require('passport'),
    logger = require('mean-logger');

/**
 * Main application entry file.
 * Please note that the order of loading is important.
 */

// Initializing system variables
var config = require('./server/config/config');
var db = mongoose.connect(config.db);

// Bootstrap Models, Dependencies, Routes and the app as an express app
var app = require('./server/config/system/bootstrap')(passport, db);

// Start the app by listening on <port>
app.listen(config.port);
console.log('Express app started on port ' + config.port);

//OTHER - DATAGRAM SOCKET for RTCP
// Start listening on another port for RTCP


var server = dgram.createSocket('udp4');
var _decoder = new decoder();
var _decoderCache = new DecoderCache(12);
var _sensor = new Sensor();
var _callCache = new Cache();
var _packetWriter = new PacketWriter();

server.on('error', function (err) {
  console.log('server error:\n' + err.stack);
  server.close();
});

server.on('message', function (msg, rinfo) {
  console.log('[LISTENER] Received a message from ' + rinfo.address + ':' + rinfo.port + ' @ [%s] of size [%d] bytes.', new Date(), msg.length);
  var decoded = _decoder.decode(msg, rinfo);  //decoded is a bundle of decoded packets that eventually will get saved to mongodb (at some point)
  if (_packetWriter.getCapture().captureOn) {
    async.parallel([
      function(callback) {
        _packetWriter.write(msg, rinfo);
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
      //This function called when call is starting or already started
      function (err, callStart) {
        _callCache.setItem(callStart._id, callStart);
      },

      //This function called when call was started and call ends
      function (err, callEnd) {
        _callCache.clearItem(callEnd._id);
        console.log('Call ended.', callEnd._id);        
      }
    );

  //2 - add to decoder cache
  _decoderCache.pushPackets(rinfo.address, decoded);
});

server.on('listening', function () {
  var address = server.address();
  console.log('server listening ' +
      address.address + ':' + address.port);
});

var port = 5005;
server.bind(port, function() {
	console.log('Node.js server opening socket and listening on port ' + port);
});

// Start aggregating data every 5 seconds
var _aggregator = new Aggregator();
var aggregator = new CronJob({
  cronTime: '*/5 * * * * *',
  //Runs every 5 seconds
  onTick: function() {
  	_aggregator.aggregateAll();
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});

console.log('Starting up cron job to aggregate packets packets');
aggregator.start();

var deviceMetric = new CronJob({
  cronTime: '*/30 * * * * *',
  //Runs once a minute, at 30 seconds
  onTick: function() {
    _aggregator.updateStatistics();
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});

console.log('Starting up cron job to aggregate metrics');
deviceMetric.start();


// Initialize Purger
var _purger = new Purger();
var purger = new CronJob({
  cronTime: '0 * * * * *',
  //Runs every minute
  onTick: function() {
  	_purger.purge();
    _purger.expireCalls();
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});

console.log('Starting up cron job to purge dead packets');
purger.start();

// Initializing logger
logger.init(app, passport, mongoose);

// Expose app
exports = module.exports = app;
