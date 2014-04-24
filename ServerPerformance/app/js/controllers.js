'use strict';

/* Controllers */

angular.module('myApp.controllers', []).

//server controller
  controller('MyCtrl1', ['$scope', '$http', function($scope, $http) {

  	  //polling
	  $scope.numTimes = 1000;
	  $scope.blockSize = 50;
	  $scope.numReceived = 0;
	  $scope.result = [];
	  $scope.polling = false;
	  $scope.totalPolled = 0;
	  $scope.result10 = [];
	  $scope.stats = {

	  };


	  //charting
	  $scope.displayChart = true;
	  $scope.range = 10;
	  $scope.chartObject = {
		  "type": "LineChart",
		  "displayed": $scope.displayChart,
		  "cssStyle": "height:400px; width:800px;",
		  "data": {
		  	"cols": [
		        {id: "t", label: "Num Received", type: "number"},
		        {id: "s", label: "average", type: "number"}
		    ],
		  	"rows":[
        	]
		  },
		  "options": {
		  	"title":"Average Time Per " + $scope.blockSize + " Responses",
		  	"fill": 20,
		    "displayExactValues": true,
		    "vAxis": {
		      "title": "Time per Call (ms)",
		      "gridlines": {
		        "count": 10
		      }
		    },
		    "hAxis": {
      		  "title": "Num Received"
    		}
		  }
	  }

	  function pushResult(startTime, endTime, numreceived) {

	    //var endTime = new Date().getTime();
	    var runTime = endTime - startTime;
	    var clickTime = startTime;
	    var blockSize = $scope.blockSize;
	    var timePerCall = runTime / blockSize;
	    var aResult = {
	    	numTimes: numreceived,
	    	startTime: startTime,
	    	endTime: endTime,
	    	average: timePerCall,
	    	totalTime: runTime
	    };
	    $scope.result.push(aResult);
	    $scope.result10.push(aResult);
	   	if ($scope.result10.length >= $scope.range) {
	    	$scope.result10.splice(0,1);
	    }
	    $scope.chartObject.data.rows.push({
	    	c: [
	    		{v: numreceived},
	    		{v: timePerCall}]
	    });
	    if ($scope.chartObject.data.rows.length >= $scope.range) {
	    	$scope.chartObject.data.rows.splice(0,1);
	    }
	    computeRunningAverage(runTime, blockSize);

	    function computeRunningAverage(blocktime, blocksize) {
	    	if ($scope.stats.runningAverage === undefined) {
	    		$scope.stats.totalTime = blocktime;
	    		$scope.stats.totalBlocks = blocksize;
	    	} else {
	    		$scope.stats.totalTime += blocktime;
	    		$scope.stats.totalBlocks += blocksize;
	    	}
	    	$scope.stats.runningAverage = Math.round(($scope.stats.totalTime / $scope.stats.totalBlocks) * 10000)/10000;
	    }
	  }

	  $scope.startQuery = function() {
	  	$scope.result = [];
	  	$scope.chartObject.data.rows=[];
	  	$scope.result10 = [];
	  	$scope.stats = {};
	  	generateQuery(new Date().getTime(), 0);
	  }

	  function generateQuery(startTime, numReceived) {
	  	
      	$http({method: 'GET', url: '/show'}).
          success(function(data, status, headers, config) {
            // this callback will be called asynchronously
            // when the response is available

            numReceived = numReceived + 1;
            $scope.numReceived = numReceived;
            if (numReceived % $scope.blockSize == 0) {
            	var endTime = new Date().getTime();
            	pushResult(startTime, endTime, numReceived);
            	startTime = new Date().getTime();
            } else if (numReceived == $scope.numTimes) {
            	var endTime = new Date().getTime();
            	pushResult(startTime, endTime, numReceived);
            }
            if (numReceived < $scope.numTimes) {
            	generateQuery(startTime, numReceived);
            }

          }).
          error(function(data, status, headers, config) {
            // called asynchronously if an error occurs
            // or server returns response with an error status.
          });
	  };

	  $scope.togglePolling = function() {
	  		$scope.polling = !$scope.polling;
	  		if ($scope.polling) {
	  			$scope.totalPolling = 0;
	  			startPolling();
	  		}
	  }

	  function startPolling () {
	  	$scope.totalPolling += 1;
		$http({method: 'GET', url: '/show'}).
			success(function(data, status, headers, config) {
				if ($scope.polling) {
					startPolling();
				}
			});
	  }

  }])

//chart controller
  .controller('MyCtrl2', ['$scope', '$http', function($scope, $http) {

  	$scope.version = '';
  	$scope.init = function () {
  		$http({method: 'GET', url: '/version'}).
			success(function(data, status, headers, config) {
				$scope.version = data;
			});
  	}

  	$scope.redTeam = function() {
  		if ($scope.version.indexOf("Vertx") > -1) {
  			return true;
  		}
  		return false;
  	}

  }]);