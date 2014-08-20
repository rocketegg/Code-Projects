var express = require('express'),
	cluster = require("cluster"),
	os = require("os"),
	CronJob = require('cron').CronJob,
	dgram = require('dgram'),
	config = require('./server/config/config');

var numCPUs = os.cpus().length;
var workers = {
	name: 'rtcpslave',
	instances: Math.max(2, numCPUs/2),
};

var _rtcpServer = (function() {

	if (_rtcpServer.prototype._singletonInstance) {
        return _rtcpServer.prototype._singletonInstance;
    }

    _rtcpServer.prototype._singletonInstance = this;

    function start_master(rtcpWorkers) {
		var server = dgram.createSocket('udp4');
		server.on('error', function (err) {
	        console.log('[RTCP Load Balancer] Server error:\n' + err.stack);
	        server.close();
	    });

		var counter = 0;
	    server.on('message', function (msg, rinfo) {
			console.log('[RTCP Load Balancer] Received a message from ' + rinfo.address + ':' + rinfo.port + ' @ [%s] of size [%d] bytes.', new Date(), msg.length);
			//Load balancer
			var worker = rtcpWorkers[counter % rtcpWorkers.length];
			//console.log('[CLUSTER#MASTER] Sending to worker [%s]', worker.process.env.name + worker.process.env.instance);
			worker.send({
				data: msg,
				rinfo: rinfo
			});
			counter++;
		});

	    var port = 5005;
		server.bind(port, function() {
		    console.log('[RTCP Load Balancer] Node.js server opening socket and listening on port ' + port);
		});

		server.on('listening', function () {
		  var address = server.address();
		  console.log('[RTCP Load Balancer] Server is now listening ' +
		      address.address + ':' + address.port);
		});
	}

	var _rtcpDecoder;
	function start_slave(worker) {
		var _rtcpCollector = require('./rtcp.js');
		_rtcpDecoder = new _rtcpCollector(worker.process.env.name + worker.process.env.instance, config.db);

		worker.on('message', function(msg) {
			console.log('#[%s]# Receiving message ' + msg, worker.process.env.name + worker.process.env.instance);
			_rtcpDecoder.process(msg.data, msg.rinfo);
		});
	}

	var started = false;

	return {
		start_master: function(rtcpWorkers) {
			if (!started) {
				start_master(rtcpWorkers);
			}
		},
		start_slave: function(worker) {
			if (!started) {
				start_slave(worker);
			}
		}
	}
});

//COMMENT OUT IF USING cluster.js
var _rtcpP = new _rtcpServer();
if (cluster.isMaster) {
	var rtcpWorkers = [];
	for (var i = 0; i < workers.instances; i++) {
		var _name = workers.name + i;
	    var rtcpWorker = cluster.fork({
							name: workers.name, 
							instance: 1+i });
	    rtcpWorker.on('online', function() {
			console.log('[RTCP Load Balancer] %s is online.', workers.name);
	    });
	    rtcpWorkers.push(rtcpWorker);
	}
	_rtcpP.start_master(rtcpWorkers);
} else {
	_rtcpP.start_slave(cluster.worker);
}

module.exports = _rtcpServer;