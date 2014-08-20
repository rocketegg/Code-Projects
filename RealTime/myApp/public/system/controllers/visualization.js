'use strict';

angular.module('mean.system').controller('VisualizationController', 

	['$scope', 'Global', '$http', '$timeout', function ($scope, Global, $http, $timeout) {

    $scope.global = Global;
    $scope.options = {
        IP_ADDRESS: ''
    };

    $scope.viz = {};

    var poller;
    $scope.isPolling = false;
    $scope.chartObjects = {};
    $scope.chartAverages = {};
    $scope.deviceTracking = {};

    //Upon transition away, stop polling
    $scope.$on('$stateChangeStart', function() {
      console.log('Stopping polling of analytics/window');
      stopPolling();
    });

    function startPolling() {
    	poller = $timeout(function() {
    		$scope.poll();
    		startPolling();
    		$scope.isPolling = true;
    	}, 5000);
    }

    $scope.togglePolling = function() {
    	if ($scope.isPolling) {
    		stopPolling();
    	} else {
    		startPolling();
        $scope.chartObjects = {};
    		$scope.isPolling = true;
    	}   	
    };

    function stopPolling() {
    	if ($scope.isPolling) {
        $timeout.cancel(poller);  
        $scope.isPolling = false;
      }
    }

    $scope.startPolling = function() {
      $scope.poll();
      $scope.isPolling = true;
      startPolling();
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

    $scope.loadCalls = function(key) {
      $http({
        method: 'GET',
        url: '/calls/device',
        params: {IP_ADDRESS: key}
      }).success(function(data, status, headers, config) {
        $scope.viz[key].calls = data;
      }).error(function(data, status, headers, config) {
        console.log('error');
      });
    };

    $scope.compareCall = function(key, callId, from) {
      $http({
        method: 'GET',
        url: '/calls/' + callId
      }).success(function(data, status, headers, config) {
        $scope.viz[key].results = (from) ? data.metrics.from : data.metrics.to;
      }).error(function(data, status, headers, config) {
        console.log('error');
      });
    };

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

    $scope.export = function(data) {
      $http({
        method:'POST',
        url:'/export/object',
        data: data
      }).success(function(data) {
        if( navigator.msSaveBlob ) {
            // Save blob is supported, so get the blob as it's contentType and call save.
            var blob = new Blob([data], { type: 'text/plain' });
            navigator.msSaveBlob(blob, 'mydata.csv');
            console.log("SaveBlob Success");
        } else {
          var urlCreator = window.URL || window.webkitURL || window.mozURL || window.msURL;
          if (urlCreator) {
              // Try to use a download link
              var link = document.createElement("a");
              if ("download" in link) {
                  // Prepare a blob URL
                  var blob = new Blob([data], { type: 'text/plain' });
                  var url = urlCreator.createObjectURL(blob);
                  link.setAttribute("href", url);

                  // Set the download attribute (Supported in Chrome 14+ / Firefox 20+)
                  link.setAttribute("download", 'mydata.csv');

                  // Simulate clicking the download link
                  var event = document.createEvent('MouseEvents');
                  event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
                  link.dispatchEvent(event);

                  console.log("Download link Success");

              } else {
                  // Prepare a blob URL
                  // Use application/octet-stream when using window.location to force download
                  var blob = new Blob([data], { type: 'text/plain' });
                  var url = urlCreator.createObjectURL(blob);
                  window.location = url;

                  console.log("window.location Success");
              }

          } else {
              console.log("Not supported");
          }
        }
      
      }).error(function(data) {

      });
    };

    function trackDevice(key, average) {
      var row = average;
      $http({
        method: 'GET',
        url: '/device/find/summary',
        params: {IP_ADDRESS: key}
      }).success(function(data) {
        if (data.statistics) {
          if (data.statistics.last_hour)
            row.std_dev_jitter_hour = data.statistics.last_hour.summary.rtp_jitter ? data.statistics.last_hour.summary.rtp_jitter.stddev : 0;
          if (data.statistics.last_ten_min)
            row.std_dev_jitter_ten_min = data.statistics.last_ten_min.summary.rtp_jitter ? data.statistics.last_ten_min.summary.rtp_jitter.stddev : 0;
          if (data.statistics.last_five_min)
            row.std_dev_jitter_five_min = data.statistics.last_five_min.summary.rtp_jitter ? data.statistics.last_five_min.summary.rtp_jitter.stddev : 0;
          if (data.statistics.last_min)
            row.std_dev_jitter_min = data.statistics.last_min.summary.rtp_jitter ? data.statistics.last_min.summary.rtp_jitter.stddev : 0;

          if (!$scope.deviceTracking[key]) {
            $scope.deviceTracking[key] = [];
          }
          $scope.deviceTracking[key].push(row);
                //Size control
          if ($scope.deviceTracking[key].length > $scope.viz[key].options.buffer.size && $scope.viz[key].options.buffer.size > 0) {
            while ($scope.deviceTracking[key].length > $scope.viz[key].options.buffer.size) {
              $scope.deviceTracking[key].splice(0,1);
            }
          }
        }
      });
    }
    
    function processCharts (active_devices) {
        for (var key in $scope.chartObjects) {
            if (!active_devices.hasOwnProperty(key)) {  //device no longer being reported
                delete $scope.chartObjects[key];
                delete $scope.chartAverages[key];
                delete $scope.viz[key];
                delete $scope.deviceTracking[key];
            }
        }

        for (var key in active_devices) {
            if ($scope.chartObjects.hasOwnProperty(key)) {
                //Update various objects
                pushRows($scope.chartObjects[key], active_devices[key].intervals, active_devices[key].averages);
                pushAverages($scope.chartAverages[key], active_devices[key].intervals, active_devices[key].averages);
                trackDevice(key, active_devices[key].averages);
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

                //Initialize Charts per Device
                $scope.chartObjects[key] = chartObject;
                $scope.chartAverages[key] = chartAverage;

                //Device Tracking
                trackDevice(key, active_devices[key].averages);

                //Initialize Visualization Options per Device
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
                    buffer: {
                      size: 50
                    },
                    window: 'Last 5 minutes'
                  },
                  results: {}
                }
            }
        }
    }
    
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

    //This function pushes the average (over the window) onto the chart average object
    //for a device
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
    if (items) {
      return items.slice().reverse();  
    } else {
      return items;
    }
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