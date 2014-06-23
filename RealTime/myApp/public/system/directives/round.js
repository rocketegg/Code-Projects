angular.module('mean.system')

.controller("RoundController", ['$scope', function($scope) {

  $scope.round = function(number, decimals) {
    if (decimals < 0) { decimals = 0 }
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

}])

.directive("aRound", ['$resource', function($resource) {
  return {
    restrict: 'E',
    scope: {
      number: '=',
      decimals: '='
    },
    controller: 'RoundController',
    templateUrl: 'public/system/views/directives/round.html'
  };
}]);