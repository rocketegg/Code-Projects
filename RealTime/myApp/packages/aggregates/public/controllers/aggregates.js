'use strict';

angular.module('mean').controller('AggregatesController', ['$scope', '$http', 'Global',
  function($scope, $http, Global, Aggregates) {
    $scope.global = Global;

    $scope.init = function() {
    	$http.get('/aggregates')
    		.success(function(data) {
    			$scope.aggregates = data;
    		})
    };

    $scope.create = function(metadata) {
    	console.log('Creating aggregate with metadata: ' + metadata)
    	$http.post('/aggregates', metadata).success(function(data) {
    		$scope.init();
    	}).error({

    	});

    };


  }
]);