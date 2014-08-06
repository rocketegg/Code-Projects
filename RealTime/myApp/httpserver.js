var Aggregator = require ('./server/controllers/util/Aggregator.js'),
	CronJob = require('cron').CronJob,
	mongoose = require('mongoose'),
	passport = require('passport'),
	logger = require('mean-logger');
	appPath = process.cwd(),
	config = require('./server/config/config');

/*
* Forked process that runs aggregation on a separate core, will be handled by cluster
*/
var _httpServer = (function(port, dbconfig) {

	if (_httpServer.prototype._singletonInstance) {
        return _httpServer.prototype._singletonInstance;
    }

    _httpServer.prototype._singletonInstance = this;

	// Initializing system variables
	var dbconfig = dbconfig ? dbconfig : config.db;
	var port = port ? port : config.port;
	
	var started = false;
	console.log(config.db);
	var db = mongoose.connect(config.db);
	var app = require('./server/config/system/bootstrap')(passport, db);

	function start() {
		// Bootstrap Models, Dependencies, Routes and the app as an express app
		app.listen(port);
		console.log('Express app started on port ' + port);
		started = true;
	}

	return {
		// Start the app by listening on <port>
		start: function() {
			if (!started) {
				start();
			}

		},
		end: function() {
			
		}
	}
});

//COMMENT OUT IF USING cluster.js
var _localHttpServer = new _httpServer(config.port, config.db);
_localHttpServer.start();

module.exports = _httpServer;