angular.module('mean.system')

.directive("aMos", ['$resource', function($resource) {
  return {
    restrict: 'E',
    scope: {
      mos: '=',
      green: '=',
      yellow: '=',
      showmos: '='
    },
    templateUrl: 'public/system/views/directives/status.html'
  };
}]);