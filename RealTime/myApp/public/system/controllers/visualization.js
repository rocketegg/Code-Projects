'use strict';

angular.module('mean.system').controller('VisualizationController', 

	['$scope', 'Global', '$http', '$timeout', function ($scope, Global, $http, $timeout) {

    $scope.global = Global;
    $scope.options = {
        IP_ADDRESS: '127.0.0.1'
    };

    $scope.viz = {};

    var poller;
    $scope.isPolling = false;
    $scope.chartObjects = {};
    $scope.chartAverages = {};

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
    };

    $scope.stopPolling = function() {
    	stopPolling();
    };

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

      $http({
        method: 'GET',
        url: '/calls/active'
      }).success(function(data, status, headers, config) {
        for (var i = 0; i < data.length; i++) {
          var duration = new Date(data[i].endTime).getTime() - new Date(data[i].startTime).getTime();
          data[i].duration = convertMStoHMS(duration);
        }

        $scope.calls = data;
      }).error(function(data, status, headers, config) {
        console.log('error');
      });
    };

    function convertMStoHMS(duration) {
      var orig = Math.floor(duration / 1000);
      duration = orig;
      var hours = Math.floor(duration / 3600);
      var hours_prefix = hours < 10 ? '0' : '';
      duration = duration % 3600;
      var minutes = Math.floor(duration / 60);
      var minutes_prefix = minutes < 10 ? '0' : '';
      duration = duration % 60;
      var seconds = duration;
      var seconds_prefix = seconds < 10 ? '0' : '';
      return hours_prefix + hours + ':' + minutes_prefix + minutes + ':' + seconds_prefix + seconds;
    }

    $scope.compare = function(key, options) {
      if (!options)
        return;
      var currTime = new Date().getTime();
      options.endTime = currTime;
      if (options.window === 'Custom') {
        options.endTime -= (options.slidervalue.split(';')[0] * 60000);
        options.startTime = options.endTime - (options.slidervalue.split(';')[1] * 60000);
      } else if (options.window === 'Last minute') {
        options.startTime = options.endTime - 60000;
      } else if (options.window === 'Last 5 minutes') {
        options.startTime = options.endTime - (60000 * 5);
      } else if (options.window === 'Last 10 minutes') {
        options.startTime = options.endTime - (60000 * 10);
      } else if (options.window === 'Last hour') {
        options.startTime = options.endTime - (60000 * 60);
      }
      console.log(key);
      console.log(options);
      $http({
        method: 'GET',
        url: '/analytics/qos',
            params: {device: key, startTime: options.startTime, endTime: options.endTime}
      }).success(function(data, status, headers, config) {
        $scope.viz[key].results = data;
      }).error(function(data, status, headers, config) {
        console.log('error');
      });
    };

    $scope.addIP = function (IP_ADDRESS) {
      if (!$scope.containsIP(IP_ADDRESS)) {
        $scope.options.IP_ADDRESS += ', ' + IP_ADDRESS;
      }
    };

    $scope.removeIP = function (IP_ADDRESS) {
      if ($scope.containsIP(IP_ADDRESS)) {
        $scope.options.IP_ADDRESS = $scope.options.IP_ADDRESS.replace(', ' + IP_ADDRESS, '').replace(',' + IP_ADDRESS,'');
      }
    };

    $scope.containsIP = function(IP_ADDRESS) {
      return $scope.options.IP_ADDRESS.indexOf(IP_ADDRESS) > -1;
    }
    
    function processCharts (active_devices) {
        for (var key in $scope.chartObjects) {
            if (!active_devices.hasOwnProperty(key)) {  //device no longer being reported
                delete $scope.chartObjects[key];
                delete $scope.chartAverages[key];
                delete $scope.viz[key];
            }
        }

        for (var key in active_devices) {
            if ($scope.chartObjects.hasOwnProperty(key)) {
                //update
                pushRows($scope.chartObjects[key], active_devices[key].intervals, active_devices[key].averages);
                pushAverages($scope.chartAverages[key], active_devices[key].intervals, active_devices[key].averages);
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
                        4: {type: "bar"}
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

                var chartAverage = {
                  "type": "ComboChart",
                  "displayed": true,
                  "options": {
                      "title":"Device Inspection: " + key,
                      //"fill": 20,
                      "displayExactValues": true,
                      "seriesType": "bars",
                      "series": {
                        0: {type: "line"},
                        1: {type: "bar"},
                        2: {type: "bar"},
                        3: {type: "bar"},
                        4: {type: "line"},
                        5: {type: "line"}
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
                      {id: "s", label: "RTP Packet rate", type: "number"},
                      {id: "u", label: "Packet Loss Rate", type: "number"},
                      {id: "v", label: "Packet OOO Rate", type: "number"},
                      {id: "w", label: "Jitter Buffer Delay", type: "number"},
                      {id: "x", label: "MOS Score", type: "number"}
                      ],
                    "rows":[
                    ]
                  }
                };

                pushRows(chartObject, active_devices[key].intervals, active_devices[key].averages);
                pushAverages(chartAverage, active_devices[key].intervals, active_devices[key].averages);
                $scope.chartObjects[key] = chartObject;
                $scope.chartAverages[key] = chartAverage;
                $scope.viz[key] = {
                  options: {
                    slidervalue: '0;5',
                    slideroptions: {       
                      from: 0,
                      to: 60,
                      step: 1,
                      dimension: " minutes ago",
                      scale: [0, '|', 10, '|', 20, '|' , 30, '|', 40, '|', 50, '|', 60]       
                    },
                    window: 'Last 5 minutes'
                  },
                  results: {}
                }
            }
        }
    }

    // $scope.$watchCollection('viz', function(newvalue, oldvalue) {
    //   console.log(newvalue);
    //   updateChartRange(newvalue);
    // }, true);

    // function updateChartRange(key, newvalue) {
    //   var to = newvalue.split(';')[0];
    //   var from = newvalue.split(';')[1];
    //   $scope.viz[key].options.endTime = new Date().getTime() - (to * 1000 * 60);
    //   $scope.viz[key].options.startTime = new Date().getTime() - (from * 1000 * 60);
    // }

    
    function pushRows(chartObject, data, averages) {
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

    function pushAverages(chartAverages, data, averages) {
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
                    {v: averages.rtp_rate},
                    {v: averages.rtp_loss_rate},
                    {v: averages.rtp_ooo_rate},
                    {v: averages.rtp_jitter},
                    {v: averages.mos.MOS}]
            };
        }
        //chartAverages.data.rows = [];
        var lastRow = data[data.length-1];
        if (lastRow)
          chartAverages.data.rows.push(createChartRow(data[data.length-1]));
        if (chartAverages.data.rows.length > 12) {
          chartAverages.data.rows.splice(0,1);
        }
    }

}])

.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
})

.directive('arbor', function() {
    return{
        restrict: 'A',
        scope: {graphData1: '=data'},
        link: function(scope, elem, attrs) {
            scope.$watch("graphData1", function(v) {
                console.log("watching graph data");
                console.log(v);
                // Initialise arbor
                sys.parameters({stiffness:600, repulsion:2000, gravity:false, dt:0.015});
                sys.renderer = Renderer("#viewport");
                //sys.graft(v);
                sys.merge(v);
                sys.tweenNode("KooKoo", 3, {color:"#0431B4", radius:2})
                //sys.start();

            });
        }
    };
});
;