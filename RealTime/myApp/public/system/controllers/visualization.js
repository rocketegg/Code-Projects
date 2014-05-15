'use strict';

angular.module('mean.system').controller('VisualizationController', 

	['$scope', 'Global', '$http', '$timeout', function ($scope, Global, $http, $timeout) {

    $scope.global = Global;
    $scope.options = {
        IP_ADDRESS: '127.0.0.1'
    };

    var poller;
    $scope.isPolling = false;
    $scope.chartObjects = {};
    function startPolling() {
    	poller = $timeout(function() {
    		$scope.poll();
    		startPolling();
    		$scope.isPolling = true;
    	}, 5000);
    }

    $scope.togglePolling = function() {
    	if ($scope.isPolling) {
    		$timeout.cancel(poller);	
    		$scope.isPolling = false;
    	} else {
    		startPolling();
            $scope.chartObjects = {};
    		$scope.isPolling = true;
    	}   	
    }

    $scope.stopPolling = function() {
    	stopPolling();
    }

    $scope.poll = function() {
		//check status of cron job
    	$http({
    		method: 'GET',
    		url: '/analytics/window',
            params: {IP_ADDRESS: $scope.options.IP_ADDRESS}
    	}).success(function(data, status, headers, config) {
    		$scope.visualizationdata = data.active_devices;
            processCharts(data.active_devices);
    	}).error(function(data, status, headers, config) {
    		console.log('error');
    	});
    };

    
    function processCharts (active_devices) {
        for (var key in active_devices) {
            if ($scope.chartObjects.hasOwnProperty(key)) {
                //update
                pushRows($scope.chartObjects[key], active_devices[key].intervals);
            } else {
                var chartObject = {
                  "type": "ComboChart",
                  "displayed": true,
                  "options": {
                      "title":"Device Inspection: " + key,
                      //"fill": 20,
                      "displayExactValues": true,
                      "seriesType": "bars",
                      "series": {
                        0: {type: "line"},
                        1: {type: "line"},
                        2: {type: "bar"},
                        3: {type: "bar"},
                        4: {type: "bar"},
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
                      {id: "s", label: "Incoming RTP packets", type: "number"},
                      {id: "u", label: "Packet Loss", type: "number"},
                      {id: "v", label: "Rejected Packets", type: "number"},
                      {id: "w", label: "Jitter Buffer Delay", type: "number"}
                      ],
                    "rows":[
                    ]
                  }
                };

                pushRows(chartObject, active_devices[key].intervals);

                $scope.chartObjects[key] = chartObject;
            }
        }
    }
    
    function pushRows(chartObject, data) {
        function createChartRow(interval) {
            var date = new Date(interval.timestamp);
            // hours part from the timestamp
            var hours = date.getHours();
            // minutes part from the timestamp
            var minutes = date.getMinutes();
            // seconds part from the timestamp
            var seconds = date.getSeconds();

            // will display time in 10:30:23 format
            var formattedTime = hours + ':' + minutes + ':' + seconds;
            return {
                c: [{v: formattedTime},
                    {v: interval.rtp_interval_packets},
                    {v: interval.rtp_interval_packet_loss},
                    {v: interval.rtp_interval_packets_out_of_order},
                    {v: interval.jitter_buffer_delay}]
            };
        }
        chartObject.data.rows = [];
        for (var i = 0; i < data.length; i++) {
            chartObject.data.rows.push(createChartRow(data[i]));
        }
    }

}])

.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
});