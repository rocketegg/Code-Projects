'use strict';

angular.module('mean').config(['$stateProvider', '$urlRouterProvider',
  function($stateProvider, $urlRouterProvider) {
    $stateProvider
      .state('mymodule example page', {
        url: '/mymodule/example',
        templateUrl: 'mymodule/views/index.html'
      })
  }
])