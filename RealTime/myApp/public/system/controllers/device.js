'use strict';

angular.module('mean.system').controller('DeviceController', 

	['$scope', 'Global', '$http', '$timeout', '$stateParams', function ($scope, Global, $http, $timeout, $stateParams) {

    $scope.global = Global;

    var poller;
    $scope.isPolling = false;
    function startPolling() {
        $scope.poll();
    	poller = $timeout(function() {
    		startPolling();
    		$scope.isPolling = true;
    	}, 5000);
    }

    $scope.$on('$stateChangeStart', function() {
      console.log('Stopping polling of analytics/window');
      stopPolling();
    });

    function stopPolling() {
      if ($scope.isPolling) {
        $timeout.cancel(poller);  
        $scope.isPolling = false;
      }
    }

    $scope.startPolling = function() {
        startPolling();
    };

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

    $scope.poll = function() {
		//check status of cron job
    	$http({
    		method: 'GET',
    		url: '/device/all'
    	}).success(function(data, status, headers, config) {
    		$scope.devices = data;
    	}).error(function(data, status, headers, config) {
    		console.log('error');
    	});
    };

    $scope.findOne = function() {
        $http({
            method: 'GET',
            url: '/device/' + $stateParams.deviceId
        }).success(function(data, status, headers, config) {
            $scope.device = data;
            $scope.chart_min = processCharts(data.statistics.last_min.rollup);
            $scope.chart_five_min = processCharts(data.statistics.last_five_min.rollup);
            $scope.chart_ten_min = processCharts(data.statistics.last_ten_min.rollup);
            $scope.chart_hour = processCharts(data.statistics.last_hour.rollup);
            $scope.loadCallsForDevice($scope.device.metadata.IP_ADDRESS);
        }).error(function(data, status, headers, config) {
            console.log('error');
        });
    };

    $scope.loadCallsForDevice = function(IP) {
        $http({
            method: 'GET',
            url: '/calls/device/',
            params: {IP_ADDRESS: IP}
        }).success(function(data, status, headers, config) {
            for (var i = 0; i < data.to.length; i++) {
                var duration = new Date(data.to[i].endTime).getTime() - new Date(data.to[i].startTime).getTime();
                data.to[i].duration = $scope.convertMStoHMS(duration);
            }

            for (var i = 0; i < data.from.length; i++) {
                var duration = new Date(data.from[i].endTime).getTime() - new Date(data.from[i].startTime).getTime();
                data.from[i].duration = $scope.convertMStoHMS(duration);
            }
            $scope.callsToDevice = data.to;
            $scope.callsFromDevice = data.from;
        }).error(function(data, status, headers, config) {
            console.log('error');
        });
    };

    $scope.convertMStoHMS = function(duration) {
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
    };

    $scope.round = function(number) {
        return Math.round(number * 100) / 100;
    };

    function processCharts (rollup) {
        var chartObject = {
          "type": "ComboChart",
          "displayed": true,
          "options": {
              "title":"MOS Score Over Time: ",
              //"fill": 20,
              "displayExactValues": true,
              "seriesType": "bars",
              "series": {
                0: {type: "line"},
                1: {type: "line"},
                2: {type: "line"}
              },
              "isStacked": true,
              "vAxes": [
                  { "title": "MOS",
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
              {id: "MOS", label: "MOS Score", type: "number"},
              {id: "MOS_corrected", label: "MOS Corrected", type: "number"},
              ],
            "rows":[
            ]
          }
        };

        for (var i = 0; i < rollup.length; i++) {
            chartObject.data.rows.push(createRow(rollup[i]));
        }

        return chartObject;
    }

    $scope.plot = function(chartObject, rollup, key) {
        chartObject.data.cols.push({
            id:key, label:key, type:'number'
        });
        for (var i = 0; i < chartObject.data.rows.length; i++) {
            var row = chartObject.data.rows[i];
            if (key === 'MOS' || key === 'MOS_corrected' || key === 'RFactor') {
                var value = rollup[i].metrics && rollup[i].metrics.mos ? rollup[i].metrics.mos[key] : 0;
                row.c.push({
                    v: value
                });
                chartObject.data.rows[i] = row;
            } else {
                var value = rollup[i].metrics ? rollup[i].metrics[key] : 0;
                row.c.push({
                    v: value
                });
                chartObject.data.rows[i] = row;
            }
        }
    };

    //TODO - finish unplot, plus and minus button, compute std devs and put in array
    $scope.unplot = function(chartObject, key) {
        var index = $scope.hasPlot(chartObject, key);
        if (index !== -1) {
            chartObject.data.cols.splice(index, 1);
            for (var i = 0; i < chartObject.data.rows.length; i++) {
                chartObject.data.rows[i].c.splice(index, 1);
            }
        }
    };

    $scope.hasPlot = function(chartObject, key) {
        return chartObject.data.cols.map(function(i) { return i.id }).indexOf(key);
    };

    $scope.lastUpdate = function(rollup) {
        if (rollup[rollup.length -1]) {
            return new Date(rollup[rollup.length -1].endTime);
        }
    };

    $scope.firstUpdate = function(rollup) {
        if (rollup[0]) {
            return new Date(rollup[0].startTime);
        }
    };

    function createRow(interval) {
        var date = new Date(interval.startTime);
        // hours part from the timestamp
        var hours = date.getHours();
        // minutes part from the timestamp
        var minutes = date.getMinutes();
        // seconds part from the timestamp
        var seconds = date.getSeconds();

        // will display time in 10:30:23 format
        var formattedTime = hours + ':' + minutes + ':' + seconds;
        if (interval.metrics) {
            var mos = interval.metrics.mos ? interval.metrics.mos.MOS : 0;
            var mos_corrected = interval.metrics.mos ? interval.metrics.mos.MOS_corrected : 0;
            return {
                c: [{v: formattedTime},
                    {v: mos},
                    {v: mos_corrected}]
            };
        } else {
            return {
                c: [{v: formattedTime},
                    {v: 0},
                    {v: 0}]
            };
        }

    }
}])

.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
});