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

  $scope.slidervalue = '0;15';
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
	          "title":"Basic Chart",
	          //"fill": 20,
	          "displayExactValues": true,
	          "seriesType": "bars",
	          "series": {
	            0: {type: "line"},
	            1: {type: "line"}
	          },
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
	          {id: "u", label: "Unique IPs", type: "number"}
	          ],
	        "rows":[
	        ]
	      }
	    };

	function createChartObjects(data) {

        function createChartRow(datapoint) {
        	return {
	            c: [{v: new Date(datapoint.timestamp)},
	                {v: datapoint.stats.total_packets},
	                {v: datapoint.stats.unique_ips.length}]
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



}]);