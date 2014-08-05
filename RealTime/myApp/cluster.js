var express = require('express'),
	cluster = require("cluster"),
	os = require("os"),
	CronJob = require('cron').CronJob,
	_forkAggregator = require('./aggregator.js'),
	dgram = require('dgram');

var numCPUs = os.cpus().length;
var workers = {
	aggregator: {
		name: 'aggregator',
		instances: 1,
		type: 'secondary',
		config: configAggregator
	},
	httpserver: {
		name: 'httpserver',
		instances: 1,
		type: 'secondary',
		config: configHTTPServer
	},
	rtcpmaster: {
		name: 'rtcpmaster',
		instances: 1,	//should stay @ 1
		type: 'primary',
		config: configRTCP
	},
	rtcpslave: {
		name: 'rtcpslave',
		instances: Math.max(2, numCPUs/2),
		type: 'secondary',
		config: configRTCP
	},
	devicestats: {
		name: 'devicestats',
		instances: 1,
		type: 'secondary',
		config: configDeviceStats
	}
};

if (cluster.isMaster) {

	console.log("CPUS: " + numCPUs);

	//Instantiate workers
	var aggregatorWorkers = [];
	for (var i = 0; i < workers.aggregator.instances; i++) {
		var aggregator = cluster.fork({
			name: workers.aggregator.name, 
			instance: 1+i,
			type: workers.aggregator.type, 
			config: workers.aggregator.config });
		aggregator.on('online', function() {
			console.log('[CLUSTER] Aggregator is online.');
		});
		aggregatorWorkers.push(aggregator);
	}

	//Instantiate HTTP server
	var httpWorkers = [];
	for (var i = 0; i < workers.httpserver.instances; i++) {
		var httpserver = cluster.fork({
			name: workers.httpserver.name, 
			instance: 1+i,
			type: workers.httpserver.type,
			config: workers.httpserver.config });
		httpserver.on('online', function() {
			console.log('[CLUSTER] Http Server is online.');
		});
		httpWorkers.push(httpserver);
	}

	//Instantiate RTCP master collector
	var rtcpmaster = cluster.fork({
		name: workers.rtcpmaster.name, 
		instance: 1,
		type: workers.rtcpmaster.type,
		config: workers.rtcpmaster.config });
	

	//Instantiate RTCP slave collectors
	var rtcpWorkers = [];
	for (var i = 0; i < workers.rtcpslave.instances; i++) {
		var _name = workers.rtcpslave.name + i;
	    var rtcpWorker = cluster.fork({
							name: workers.rtcpslave.name, 
							instance: 1+i,
							type: workers.rtcpslave.type,
							config: workers.rtcpslave.config });
	    rtcpWorker.on('online', function() {
			console.log('[CLUSTER] %s is online.', workers.rtcpslave.name);
	    });
	    rtcpWorkers.push(rtcpWorker);
	}

	//Instantiate Device Stats Aggregator
	var deviceStatsWorkers = [];
	for (var i = 0; i < workers.devicestats.instances; i++) {
		var devicestats = cluster.fork({
			name: workers.devicestats.name, 
			instance: 1+i,
			type: workers.devicestats.type,
			config: workers.devicestats.config });
		devicestats.on('online', function() {
			console.log('[CLUSTER] devicestats is online.');
		});
		deviceStatsWorkers.push(devicestats);
	}

	//Sound the starting bell
	rtcpmaster.on('online', function() {
		console.log('[CLUSTER] RTCP collector master is online.');
		for (var i = 0; i < rtcpWorkers.length; i++) {
			rtcpWorkers[i].send('start');
		}
		for (var i = 0; i < httpWorkers.length; i++) {
			httpWorkers[i].send('start');
		}
		for (var i = 0; i < aggregatorWorkers.length; i++) {
			aggregatorWorkers[i].send('start');
		}
		for (var i = 0; i < deviceStatsWorkers.length; i++) {
			deviceStatsWorkers[i].send('start');
		}
	});

	configMaster(rtcpWorkers);

	cluster.on('exit', function(worker, code, signal) {
	    console.log('worker ' + worker.process.pid + ' died');
	});
} else if (cluster.isWorker) {
	console.log('[CLUSTER#SLAVE] Beginning config for worker [%s%d].', cluster.worker.process.env.name, cluster.worker.process.env.instance);
	workers[cluster.worker.process.env.name].config(cluster.worker);
}

//Master Config
/*
* The master acts as a proxy that filters incoming packet streams by IP address to either
* stupidly (i.e. sequentially)
*/
function configMaster(workers) {
	var server = dgram.createSocket('udp4');
	server.on('error', function (err) {
        console.log('[CLUSTER#MASTER] Server error:\n' + err.stack);
        server.close();
    });

	var counter = 0;
    server.on('message', function (msg, rinfo) {
		console.log('[CLUSTER#MASTER] Received a message from ' + rinfo.address + ':' + rinfo.port + ' @ [%s] of size [%d] bytes.', new Date(), msg.length);
		//Load balancer
		var worker = workers[counter % workers.length];
		//console.log('[CLUSTER#MASTER] Sending to worker [%s]', worker.process.env.name + worker.process.env.instance);
		worker.send({
			data: msg,
			rinfo: rinfo
		});
		counter++;
	});

    var port = 5005;
	server.bind(port, function() {
	    console.log('[CLUSTER#MASTER] Node.js server opening socket and listening on port ' + port);
	});

	server.on('listening', function () {
	  var address = server.address();
	  console.log('[CLUSTER#MASTER] Server is now listening ' +
	      address.address + ':' + address.port);
	});
}

//Worker Configs
var mongoose = require('mongoose'),
    passport = require('passport'),
	config = require('./server/config/config');

function configAggregator(worker) {
	//bind event handlers
	worker.on('message', function(msg) {
		console.log('#[%s]# Receiving message ' + msg, worker.process.env.name + worker.process.env.instance);
		if (msg === 'start') {
			var _aggWorker = new _forkAggregator(5, config.db);
			_aggWorker.start();
		} else if (msg === 'stop') {

		}
	});
}

var mean = require('meanio');
function configHTTPServer(worker) {
	//bind event handlers
	worker.on('message', function(msg) {
		console.log('#[%s]# Receiving message ' + msg, worker.process.env.name + worker.process.env.instance);

		if (msg === 'start') {
			mean.app('RTCP Collector Prototype',{});
			var db = mongoose.connect(config.db);
			var app = require('./server/config/system/bootstrap')(passport, db);
			// Start the app by listening on <port>
			app.listen(config.port);
			console.log('Express app started on port ' + config.port);
		} else if (msg === 'stop') {
			//close down connections
		}

	});
}

var _rtcpCollector = require('./rtcp.js');
var _localRTCPCollector;
function configRTCP(worker) {
	//bind event handlers
	worker.on('message', function(msg) {
		console.log('#[%s]# Receiving message ' + msg, worker.process.env.name + worker.process.env.instance);
		if (msg === 'start') {
			_localRTCPCollector = new _rtcpCollector(config.db);
			_localRTCPCollector.start(worker.process.env.name + worker.process.env.instance);
		} else if (msg === 'stop') {
			//close down connections
		} else { 
			_localRTCPCollector.process(msg.data, msg.rinfo);
		}
	});
}

var _deviceStats = require('./devicer.js');
function configDeviceStats(worker) {
	worker.on('message', function(msg) {
		console.log('#[%s]# Receiving message ' + msg, worker.process.env.name + worker.process.env.instance);
		if (msg === 'start') {
			var _devicer = new _deviceStats(50, 10, config.db);	//initial pace, pace min
			_devicer.start(15);
		} else if (msg === 'stop') {
			//close down connections
		}
	});
}



























