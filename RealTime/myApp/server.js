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
  DeviceCache = require('./server/controllers/util/DeviceCache.js'),
  Sensor = require('./server/controllers/util/Sensor.js'),
  Cache = require('./server/controllers/util/Cache.js'),
  PacketWriter = require('./server/controllers/util/PacketWriter.js'),
  async = require('async'),
  net = require('net'),
  DecoderCDR = require('./server/controllers/decoder_cdr.js');

mean.app('RTCP Collector Prototype',{});

//require('look').start();
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
var _deviceCache = new DeviceCache();

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

      //This function called when call is starting or already started, callStart is the call object
      function (err, callStart) {
        _callCache.setItem(callStart._id, callStart);
      },

      //This function called when call was started and call ends, callEnd is the call object
      function (err, callEnd) {
        _callCache.clearItem(callEnd._id);
        console.log('Call ended: ', callEnd._id);        
      }
    );

  //3 - add to decoder cache
  _decoderCache.pushPackets(rinfo.address, decoded);

  //4 - backfill device info, this should only be done every so often (202 is an SDES packet)
  var idx = decoded.map(function(packet) { return packet.metadata.TYPE; }).indexOf(202);
  if (idx > -1) {
    _deviceCache.updateMetadata(rinfo.address, decoded[idx]);
  }
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

var updateStatisticsPace = 50;
var updateStatisticsPace_min = 10;
var deviceMetric = new CronJob({
  cronTime: '*/15 * * * * *',
  //Runs once a minute, at 30 seconds
  onTick: function() {
    async.waterfall([
      function(callback) {
        var Device = mongoose.model('Device');
        Device.count(function(err, count) {
          callback(null, count);
        })
      },
      function(_count, callback) {
        _aggregator.updateStatistics(undefined, updateStatisticsPace, function(result) {
          console.log('[AGGREGATOR] updateStatistics() complete.  Result: [Num Updated: %d, Duration: %d, Average per Device: %d]', result.updated, result.duration, result.average);
          if (result.average < 5) {  //<5 ms, speed up by 10%
            updateStatisticsPace = Math.min(_count, Math.floor(updateStatisticsPace * 1.1));
          } else if (result.average >= 5 && result.average < 10) { //5 < ms < 10, maintain pace
            updateStatisticsPace = Math.min(_count, updateStatisticsPace);
          } else {  //>= 10ms, slow down by 2/3, to a min of 10
            updateStatisticsPace = Math.min(_count, Math.max(updateStatisticsPace_min, Math.floor(updateStatisticsPace * .66)));
          }

          if (_count === updateStatisticsPace) { console.log('[Aggregator] updateStatistics() - Max pace reached: ' + _count); }
          console.log('[AGGREGATOR] updateStatistics() Setting new pace: %d', updateStatisticsPace);
          callback(null, result)
        });
      }
    ], function(err, result) {

    });
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
  	//_purger.purge();
    _purger.expireCalls();
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});

console.log('Starting up cron job to purge dead packets');
purger.start();

/*
* Avaya CDR Server 
* TODO: move out to separate module
*/
var _decoderCDR = new DecoderCDR();

var _cdrServer = net.createServer(function(c) { //'connection' listener
  console.log('CDR Server connected');

  // Add a 'data' event handler to this instance of socket
  c.on('data',function(data)  {
    
    console.log('[CDR] INCOMING CDR MESSAGE FROM [%s:%s] with LENGTH [%d]: ', c.remoteAddress, c.remotePort, data.length);
    var _decodedObj = _decoderCDR.decode(data);
    if (_decodedObj) {
      console.log('[CDR] Received decoded message: \n');
      console.log(_decodedObj);
    } 
  });
  
  //Add a 'close' event handler to this instance of socket
  c.on('close',function(data) {
    console.log('CLOSED:' +  c.remoteAddress + ' ' + c.remotePort);
  });

  c.on('end', function() {
    console.log('CDR Server disconnected');
  });

  //c.write('hello\r\n');

  //c.pipe(c);
});
_cdrServer.listen(5061, function() { //'listening' listener
  console.log('Opening up CDR listener on port 5061');
});



// Initializing logger
logger.init(app, passport, mongoose);

// Expose app
exports = module.exports = app;
