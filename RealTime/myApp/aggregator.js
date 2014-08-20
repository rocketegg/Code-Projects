var Aggregator = require ('./server/controllers/util/Aggregator.js'),
	CronJob = require('cron').CronJob,
	mongoose = require('mongoose'),
	appPath = process.cwd(),
	fs = require('fs'),
	config = require('./server/config/config');

/*
* Forked process that runs aggregation on a separate core, will be handled by cluster
*/
var _forkAggregator = (function(numSeconds, dbconfig) {

	if (_forkAggregator.prototype._singletonInstance) {
        return _forkAggregator.prototype._singletonInstance;
    }

    _forkAggregator.prototype._singletonInstance = this;

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
    if (!numSeconds)
    	numSeconds = 5;

    var dbconfig = dbconfig ? dbconfig : config.db;
    var db = mongoose.connect(dbconfig);
    bootstrapModels();

	// Start aggregating data every 5 seconds
	var _aggregator = new Aggregator();
	var aggregator = new CronJob({
	  cronTime: '*/' + numSeconds + ' * * * * *',
	  //Runs every 5 seconds
	  onTick: function() {
	  	//console.log('Running aggregation.');
	  	_aggregator.aggregateAll();
	  },
	  start: false,
	  timeZone: 'America/Los_Angeles'
	});
	
	var started = false;
	function start() {
		console.log('Starting up cron job to aggregate packets packets');
		aggregator.start();
		started = true;
	}

	return {
		start: function() {
			if (!started) {
				start();
			}
		},
		end: function() {
			aggregator.stop();
		}
	}
});

//COMMENT OUT IF USING cluster.js
var _aggWorker = new _forkAggregator(5, config.db);
_aggWorker.start();

module.exports = _forkAggregator;