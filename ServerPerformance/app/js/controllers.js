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

	  function pushResult(startTime, numreceived) {

	    var endTime = new Date().getTime();
	    var runTime = endTime - startTime;
	    var clickTime = startTime;
	    var timePerCall = runTime / $scope.blockSize;
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
	    	c: [{v: numreceived},
	    		{v: timePerCall}]
	    });
	    if ($scope.chartObject.data.rows.length >= $scope.range) {
	    	$scope.chartObject.data.rows.splice(0,1);
	    }
	  }

	  $scope.startQuery = function() {
	  	var startTime = new Date().getTime();
	  	$scope.result = [];
	  	$scope.chartObject.data.rows=[];
	  	$scope.result10 = [];
	  	generateQuery(startTime, 0);
	  }

	  function generateQuery(startTime, numReceived) {
	  	
      	$http({method: 'GET', url: '/show'}).
          success(function(data, status, headers, config) {
            // this callback will be called asynchronously
            // when the response is available

            numReceived = numReceived + 1;
            if (numReceived % $scope.blockSize == 0) {
            	pushResult(startTime, numReceived);
            	startTime = new Date().getTime();
            } else if (numReceived == $scope.numTimes) {
            	pushResult(startTime, numReceived);
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
  .controller('MyCtrl2', ['$scope', function() {

  }]);