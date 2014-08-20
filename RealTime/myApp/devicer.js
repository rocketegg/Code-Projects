var mongoose = require('mongoose'),
    fs = require('fs'),
    CronJob = require('cron').CronJob,
    Aggregator = require ('./server/controllers/util/Aggregator.js'),
    appPath = process.cwd(),
    async = require('async'),
    Purger = require ('./server/controllers/util/Purger.js'),
    config = require('./server/config/config');

/**
* DeviceStats - 
* Aggregates device information in the background through a cron job
*/
var _deviceStats = (function(paceStart, paceMin, interval, dbconfig) {

    if (_deviceStats.prototype._singletonInstance) {
        return _deviceStats.prototype._singletonInstance;
    }

    _deviceStats.prototype._singletonInstance = this;

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
    if (!dbconfig) {
        dbconfig = config.db;
    }
    var db = mongoose.connect(dbconfig);
    bootstrapModels();

    var updateStatisticsPace = paceStart ? paceStart : 50;
    var updateStatisticsPace_min = paceMin ? paceMin : 10;
    var _interval = interval ? interval : 15;
    var deviceMetric;

    var _aggregator = new Aggregator();
    var deviceMetric = new CronJob({
        cronTime: '*/' + _interval + ' * * * * *',
      //Runs once a minute, at 30 seconds
        onTick: function() {
          console.log('[DEVICE STATS] Running device stats computation.');
            async.waterfall([
              function(callback) {
                var Device = mongoose.model('Device');
                Device.count(function(err, count) {
                  callback(null, count);
                })
              },
              function(_count, callback) {
                _aggregator.updateStatistics(undefined, updateStatisticsPace, function(result) {
                  console.log('[DEVICE STATS] updateStatistics() complete.  Result: [Num Updated: %d, Duration: %d, Average per Device: %d]', result.updated, result.duration, result.average);
                  if (result.average < 5 && result.duration < 1000) {  //<5 ms, speed up by 10%
                    updateStatisticsPace = Math.min(_count, Math.floor(updateStatisticsPace * 1.1));
                  } else if (result.average >= 5 && result.average < 10) { //5 < ms < 10, maintain pace
                    updateStatisticsPace = Math.min(_count, updateStatisticsPace);
                  } else {  //>= 10ms, slow down by 2/3, to a min of 10
                    updateStatisticsPace = Math.min(_count, Math.max(updateStatisticsPace_min, Math.floor(updateStatisticsPace * .66)));
                  }

                  if (_count === updateStatisticsPace) { 
                    console.log('[AGGREGATOR] updateStatistics() - Max pace reached: ' + _count); 
                  }
                  console.log('[DEVICE STATS] updateStatistics() Setting new pace: %d', updateStatisticsPace);
                  callback(null, result)
                });
              }
            ], function(err, result) {

            });
        },
        start: false,
        timeZone: 'America/Los_Angeles'
    });

    var _purger = new Purger();
    var purger = new CronJob({
      cronTime: '0 * * * * *',
      //Runs every minute
      onTick: function() {
        //_purger.purge();
        console.log('[DEVICE STATS] Expiring Calls.');
        _purger.expireCalls();
      },
      start: false,
      timeZone: 'America/Los_Angeles'
    });

    var started = false;
    function start(interval) {

        console.log('Starting up cron job to aggregate metrics');
        deviceMetric.start();

        // Initialize Purger
        console.log('Starting up cron job to purge dead packets');
        purger.start();

        started = true;
    }

    function stop() {
        deviceMetric.stop();
    }

    return {
        start: function() {
            if (!started) {
              start();  
            }
        },
        stop: function() {
            stop();
        }
    } 
});

//COMMENT OUT IF USING cluster.js
var _processD = new _deviceStats(50, 10, 15, config.db);
_processD.start();

module.exports = _deviceStats;
