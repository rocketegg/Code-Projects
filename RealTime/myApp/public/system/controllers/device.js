'use strict';

angular.module('mean.system').controller('DeviceController', 

	['$scope', 'Global', '$http', '$timeout', function ($scope, Global, $http, $timeout) {

    $scope.global = Global;

    var poller;
    $scope.isPolling = false;
    function startPolling() {
    	poller = $timeout(function() {
    		$scope.poll();
    		startPolling();
    		$scope.isPolling = true;
    	}, 1000);
    }

    startPolling();

    $scope.togglePolling = function() {
    	if ($scope.isPolling) {
    		$timeout.cancel(poller);	
    		$scope.isPolling = false;
    	} else {
    		startPolling();
    		$scope.isPolling = true;
    	}   	
    }

    $scope.stopPolling = function() {
    	stopPolling();
    }

    $scope.slidervalue = '0;5';
    $scope.slideroptions = {       
        from: 0,
        to: 60,
        step: 1,
        dimension: " minutes ago",
        scale: [0, '|', 10, '|', 20, '|' , 30, '|', 40, '|', 50, '|', 60]       
    };

  	$scope.$watch('slidervalue', function(newvalue, oldvalue) {
  		updateChartRange(newvalue);
  		$scope.poll();
  	});

  	function updateChartRange(newvalue) {
  		var to = newvalue.split(';')[0];
  		var from = newvalue.split(';')[1];
  		$scope.mapreduce.endTime = new Date().getTime() - (to * 1000 * 60);
  		$scope.mapreduce.startTime = new Date().getTime() - (from * 1000 * 60);
  	}

    $scope.poll = function() {
		//check status of cron job
    	$http({
    		method: 'GET',
    		url: '/packets/status'
    	}).success(function(data, status, headers, config) {
    		$scope.jobstatus = data;
    	}).error(function(data, status, headers, config) {
    		console.log('error');
    	});

        updateChartRange($scope.slidervalue);
    };

    $scope.history = [];

    //ANALYTICS
    $scope.mapreduce = {
        device: {
            IP_ADDRESS: '127.0.0.1'
        },
    };

    $scope.metricKeys = [
        "MID_IN_RTP_DEST_PORT",
        "MID_IN_RTP_SRC_PORT",
        "MID_ECHO_CANCELLATION",
        "MID_SILENCE_SUPPRESSION",
        "MID_MEDIA_ENCYPTION",
        "MID_RTP_8021D",
        "MID_RTP_DSCP",
        "MID_RTP_TTL",
        "MID_FRAME_SIZE",
        "MID_PAYLOAD_TYPE",
        "MID_ADDR_PORT",
        "MID_ECHO_TAIL_LENGTH",
        "MID_SEQ_FALL_INSTANCES",
        "MID_SEQ_JUMP_INSTANCES",
        "MID_JITTER_BUFFER_OVERRUNS",
        "MID_JITTER_BUFFER_UNDERRUNS",
        "MID_MAX_JITTER",
        "MID_RSVP_RECEIVER_STATUS",
        "MID_LARGEST_SEQ_FALL",
        "MID_LARGEST_SEQ_JUMP",
        "MID_JITTER_BUFFER_DELAY",
        "MID_RTCP_RTT"
    ];

    $scope.redo = function(query) {
        $scope.mapreduce = query;
        $scope.reduce(false);
    }

    $scope.reduce = function(pushToHistory) {
        var ips = $scope.mapreduce.device.IP_ADDRESS.split(',');

        if (!$scope.mapreduce.metricKeys || $scope.mapreduce.metricKeys.length < 1) {
            alert('Select at least one metric to continue');
        } else if (ips.length < 1 && !$scope.mapreduce.device.extension) {
            alert('Enter at least 1 IP address or extension');
        } else {
            if (pushToHistory) {
                var query = angular.copy($scope.mapreduce, query);
                $scope.history.push(query);
            }
            $http({
                method: 'POST',
                url: '/analytics/reduce',
                data: $scope.mapreduce
            }).success(function(data) {
                console.log('Map reduce done.');
                if (data.error) {
                    $scope.mapreduceerror = data.error;
                } else {
                    $scope.mapreducedata = data;
                    $scope.show = {};
                    for (var i = 0; i < data.length; i++) {
                        $scope.show[data[i]._id] = false;
                    }
                    $scope.aggregate = processStats(data);
                    $scope.colormap = createColorMap(data);
                    $scope.mapreduceerror = '';
                }
            }).error(function(err) {
                $scope.mapreducedata = err;
            });
        }
    };

    /*
    * Computes average by number of devices
    */

    var colors = [
        'Crimson', 'DarkGreen', 'MidnightBlue', 'DarkMagenta', 'DarkOrange', 'Gold', 'LightPink', 'Aqua',  'Olive', 'Plum', 'Red', 'SteelBlue', 'YellowGreen'
    ];
    function createColorMap(data) {
        var colormap = {};
        for (var i = 0; i < data.length; i++) {
            var idx = i % colors.length;
            colormap[data[i]._id] = colors[idx];
        }
        return colormap;
    }

    function processStats(data) {
        var aggregate = {};
        if (data[0]) {
            aggregate.devices = data[0]._id;
            for (var key in data[0].value) {
                aggregate[key] = {
                    high: { 
                        value: data[0].value[key].high,
                        device: data[0]._id
                    },
                    low: {
                        value: data[0].value[key].low,
                        device: data[0]._id
                    },
                    average: {
                        value: Math.round(data[0].value[key].total / data[0].value[key].count),
                        device: data[0]._id
                    }
                } 
            }
            for (var i = 1; i < data.length; i++) {
                aggregate.devices += ', ' + data[i]._id;
                for (var key in data[i].value) {
                    //compute high
                    if (data[i].value[key].high > aggregate[key].high.value) {
                        aggregate[key].high = {
                            value: data[i].value[key].high,
                            device: data[i]._id
                        }
                    }

                    //compute low
                    if (data[i].value[key].low < aggregate[key].low.value) {
                        aggregate[key].low = {
                            value: data[i].value[key].low,
                            device: data[i]._id
                        }
                    }

                    //compute (high) average
                    var average = Math.round(data[i].value[key].total / data[i].value[key].count);
                    if (average > aggregate[key].average.value) {
                        aggregate[key].average = {
                            value: average,
                            device: data[i]._id
                        }
                    }
                }
            }
        }
        return aggregate;
    }
}])

.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
});