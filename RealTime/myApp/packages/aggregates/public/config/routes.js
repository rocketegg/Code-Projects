'use strict';

angular.module('mean').config(['$stateProvider', '$urlRouterProvider',
  function($stateProvider, $urlRouterProvider) {
    $stateProvider
      .state('all aggregates', {
        url: '/aggregates',
        templateUrl: 'aggregates/views/index.html'
      })
  }
])