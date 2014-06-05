angular.module('mean.system')

.controller("PercentController", ['$scope', function($scope) {

  $scope.getValue = function() {
    //if (!$scope.value) {
      $scope.value = $scope.percent($scope.numerator, $scope.denominator);
    //} 
    return $scope.value;
  };

  $scope.percent = function(numerator, denominator) {
    if (numerator === 0 && denominator === 0) {
      return 100;
    }
    return Math.round(numerator / denominator * 100 * 100) / 100;
  };

}])

.directive("aPercent", ['$resource', function($resource) {
  return {
    restrict: 'E',
    scope: {
      numerator: '=',
      denominator: '=',
      bias: '='
    },
    controller: 'PercentController',
    templateUrl: 'public/system/views/directives/percent.html'
  };
}]);