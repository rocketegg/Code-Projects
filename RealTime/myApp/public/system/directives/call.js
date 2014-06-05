angular.module('mean.system')

.directive("aCall", ['$resource', function($resource) {
  return {
    restrict: 'E',
    scope: {
      call: '=',
      highlight: '=',
    },
    templateUrl: 'public/system/views/directives/call.html'
  };
}]);