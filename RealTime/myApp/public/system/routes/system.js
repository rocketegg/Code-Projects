'use strict';

//Setting up route
angular.module('mean.system').config(['$stateProvider', '$urlRouterProvider',
        function($stateProvider, $urlRouterProvider) {
            // For unmatched routes:
            $urlRouterProvider.otherwise('/');

            // states for my app
            $stateProvider              
                .state('home', {
                    url: '/',
                    templateUrl: 'public/system/views/index.html'
                })                
                .state('device statistics', {
                    url: '/device',
                    templateUrl: 'public/system/views/devices.html'
                })
                .state('call visualization', {
                    url: '/visualization/call/:callId',
                    templateUrl: 'public/system/views/call.html'
                })
                .state('device visualization', {
                    url: '/visualization',
                    templateUrl: 'public/system/views/visualization.html'
                })
                .state('packet simulator', {
                    url: '/',
                    templateUrl: 'public/system/views/index.html'
                })
                .state('auth', {
                    templateUrl: 'public/auth/views/index.html'
                });
        }
    ])
    .config(['$locationProvider',
        function($locationProvider) {
            $locationProvider.hashPrefix('!');
        }
    ]);
