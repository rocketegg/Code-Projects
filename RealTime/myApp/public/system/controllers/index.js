'use strict';

angular.module('mean.system').controller('IndexController', 

	['$scope', 'Global', '$http', '$timeout', function ($scope, Global, $http, $timeout) {

    $scope.global = Global;

    $scope.options = {
    	interval: '5',
    	iterations: 10,
    	ip: '127.0.0.1',
    	port: 5006
    };

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

    $scope.start = function(options) {
    	$http({
    		method: 'POST',
    		url: '/packets/start',
    		data: options
    	}).success(function(data, status, headers, config) {
    		console.log('success');
    	}).error(function(data, status, headers, config) {
    		console.log('error');
    	});
    };

    $scope.stop = function(options) {
    	$http({
    		method: 'POST',
    		url: '/packets/stop',
    		data: options
    	}).success(function(data, status, headers, config) {
    		console.log('success');
    	}).error(function(data, status, headers, config) {
    		console.log('error');
    	});
    };

    $scope.chartOptions = {
    	startTime: new Date().getTime(),
    	endTime: new Date().getTime(),
    	density: 1
    };

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
  		$scope.chartOptions.endTime = new Date().getTime() - (to * 1000 * 60);
  		$scope.chartOptions.startTime = new Date().getTime() - (from * 1000 * 60);
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

    	//get mongo slice (moving window based on current time)
		updateChartRange($scope.slidervalue);

		var currentTime = new Date().getTime();
    	$http({
    		method: 'GET',
    		url: '/packets/slice',
    		params: $scope.chartOptions
    	}).success(function(data, status, headers, config) {
    		var responseTime = new Date().getTime() - currentTime;
    		createChartObjects(data);
            createChartQOSObjects(data);
    		createChartStatObjects(data, responseTime);
    	}).error(function(data, status, headers, config) {
    		console.log('error');
    		createChartStatObjects(data, responseTime);
    	});

    };

	$scope.chartObject = {
	      "type": "ComboChart",
	      "displayed": true,
	      "options": {
	          "title":"RTCP Inbound Packets",
	          //"fill": 20,
	          "displayExactValues": true,
	          "seriesType": "bars",
	          "series": {
	            0: {type: "line"},
	            1: {type: "line"},
                2: {type: "bar"},
                3: {type: "bar"},
                4: {type: "bar"},
                5: {type: "bar"},
                6: {type: "bar"}
	          },
              "isStacked": true,
	          "vAxes": [
	              { "title": "Packet Flow",
	                "gridlines": {
	                  "count": 10
	                }
	              },                      
	              { "title": "Size",
	                "gridlines": {
	                  "count": 10
	                }
	              }
	          ],
	          "hAxis": {
	            "title": "Timestamp"
	          }
	      },
	      "data": {
	        "cols": [
	          {id: "t", label: "Timestamp", type: "string"},
	          {id: "s", label: "Total Packets", type: "number"},
	          {id: "u", label: "Unique IPs", type: "number"},
              {id: "200", label: "200 (Sender Reports)", type: "number"},
              {id: "201", label: "201 (Receiver Reports)", type: "number"},
              {id: "202", label: "202 (Sender Description)", type: "number"},
              {id: "203", label: "203 (Goodbye)", type: "number"},
              {id: "204", label: "204 (App-Defined)", type: "number"}
	          ],
	        "rows":[
	        ]
	      }
	    };

	function createChartObjects(data) {

        function createChartRow(datapoint) {
            var typeMap = {
                200: 0,
                201: 0,
                202: 0,
                203: 0,
                204: 0
            }
            datapoint.stats.packet_distribution.forEach(function(packet) {
                typeMap[packet.type] = packet.count ? packet.count : 0;
            });

        	return {
	            c: [{v: new Date(datapoint.timestamp)},
	                {v: datapoint.stats.total_packets},
	                {v: datapoint.stats.unique_ips.length},
                    {v: typeMap[200]},
                    {v: typeMap[201]},
                    {v: typeMap[202]},
                    {v: typeMap[203]},
                    {v: typeMap[204]}
                    ]
            };
        }

        $scope.chartData = data;
        $scope.chartData.rows = [];
        $scope.chartObject.data.rows = [];
        $scope.chartData.forEach(function(datapoint) { 
          $scope.chartObject.data.rows.push(createChartRow(datapoint));
        });

        $scope.lastChartObjectRow = $scope.chartObject.data.rows[$scope.chartObject.data.rows.length - 1];
    }

     $scope.chartObjectStats = {
	      "type": "ComboChart",
	      "displayed": true,
	      "options": {
	          "title":"Request Stats",
	          //"fill": 20,
	          "displayExactValues": true,
	          "seriesType": "bars",
	          "series": {
	            0: {type: "line"},
	            1: {type: "line"},
	          },
	          "vAxes": [
	              { "title": "# Packets Returned",
	                "gridlines": {
	                  "count": 10
	                }
	              },                      
	              { "title": "Response time (ms)",
	                "gridlines": {
	                  "count": 10
	                }
	              }                  

	          ],
	          "hAxis": {
	            "title": "Timestamp"
	          }
	      },
	      "data": {
	        "cols": [
	          {id: "w", label: "Timestamp", type: "string"},
	          {id: "x", label: "# Packets", type: "number"},
	          {id: "y", label: "Response time (ms)", type: "number"}
	          ],
	        "rows":[
	        ]
	      }
	    };

	function createChartStatObjects(data, responseTime) {

        function createChartRow() {
        	return {
	            c: [{v: new Date()},
	                {v: data ? data.length : 0},
	                {v: responseTime}]
            };
        }

        $scope.chartObjectStats.data.rows.push(createChartRow());
        if ($scope.chartObjectStats.data.rows.length > 99) {
        	$scope.chartObjectStats.data.rows.splice(0,1);
        }
        $scope.lastChartObjectStatsRow = $scope.chartObjectStats.data.rows[$scope.chartObjectStats.data.rows.length - 1];
    }

    /*
     * Quality of Service
     */

    $scope.chartObjectQOS = {
          "type": "ComboChart",
          "displayed": true,
          "options": {
              "title":"Quality of Service (QoS)",
              //"fill": 20,
              "displayExactValues": true,
              "seriesType": "line",
              "series": {
                0: {type: "line"},
                1: {type: "line"}
              },
              "vAxes": [
                  { "title": "Interarrival Jitter",
                    "gridlines": {
                      "count": 10
                    }
                  }
              ],
              "hAxis": {
                "title": "Timestamp"
              }
          },
          "data": {
            "cols": [
                {id: "asdf", label: "Timestamp", type: "string"}
              ],
            "rows":[
            ]
          }
        };

    function createChartQOSObjects(data) {

        $scope.chartObjectQOS.data.rows = [];
        var unique_devices = [];
        data.forEach(function(datapoint) { 
            //1 -find all devices
            datapoint.stats.qos.forEach(function(device) {
                if (unique_devices.indexOf(device.device) < 0) {
                    unique_devices.push(device.device);
                }
            });
        });

        //2 - create a series for each device
        $scope.chartObjectQOS.data.cols = [{id: "asdf", label: "Timestamp", type: "string"}];
        unique_devices.forEach(function(device) {
            $scope.chartObjectQOS.data.cols.push({
                id: device, label: device, type: "number"
            });
        });

        //3 - plot all data points
        data.forEach(function(datapoint) {
            var row = [];
            row.push({v: new Date(datapoint.timestamp).toTimeString()});

            unique_devices.forEach(function(device) {
                var pushed = false;
                for (var i = 0; i < datapoint.stats.qos.length; i++) {
                    if (datapoint.stats.qos[i].device == device) {
                        row.push({v:datapoint.stats.qos[i].interarrival_jitter ? datapoint.stats.qos[i].interarrival_jitter : 0});
                        pushed = true;
                        break;
                    }
                }
                if (!pushed) {
                    row.push({v:0});
                }
                
            });

            $scope.chartObjectQOS.data.rows.push({
                c: row
            });
        });

        $scope.lastChartObjectQOSRow = data[data.length - 1];
    }

    //ANALYTICS
    $scope.mapreduce = {
        device: {
            IP_ADDRESS: '10.30.12.20'
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

    $scope.reduce = function() {
        $scope.mapreduce.startTime = $scope.chartOptions.startTime;
        $scope.mapreduce.endTime = $scope.chartOptions.endTime;
        if (!$scope.mapreduce.metricKeys || $scope.mapreduce.metricKeys.length < 1) {
            alert('Select at least one metric to continue');
        } else {
            $http({
                method: 'POST',
                url: '/analytics/reduce',
                data: $scope.mapreduce
            }).success(function(data) {
                console.log('Map reduce done.');
                $scope.mapreducedata = data[0];
            }).error(function(err) {

            });
        }
    };





}]);