'use strict';
/**
 *  Mean container for dependency injection
 */
var mean = require('meanio'),
	dgram = require('dgram'),
	decoder = require('./server/controllers/decoder.js'),
	encoder = require('./server/controllers/encoder.js'),
	Aggregator = require ('./server/controllers/util/Aggregator.js'),
	Purger = require ('./server/controllers/util/Purger.js'),
	CronJob = require('cron').CronJob;

mean.app('Mean Demo App',{});

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

server.on('error', function (err) {
  console.log('server error:\n' + err.stack);
  server.close();
});

server.on('message', function (msg, rinfo) {
  console.log('[LISTENER] Server got: a message from ' + rinfo.address + ':' + rinfo.port + ' @ [%s]', new Date());
  //console.log('===================================================');
  _decoder.decode(msg, rinfo);
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
  timeZone: "America/Los_Angeles"
});

console.log('Starting up cron job to aggregate packets packets');
aggregator.start();


// Initialize Purger
var _purger = new Purger();
var purger = new CronJob({
  cronTime: '0 * * * * *',
  //Runs every minute
  onTick: function() {
  	_purger.purge();
  },
  start: false,
  timeZone: "America/Los_Angeles"
});

console.log('Starting up cron job to purge dead packets');
purger.start();

// Initializing logger
logger.init(app, passport, mongoose);

// Expose app
exports = module.exports = app;
