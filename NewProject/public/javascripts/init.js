'use strict';

// Default modules
var modules = ['ngCookies', 'ngResource', 'ui.bootstrap', 'ui.router', 'ui.utils'];

// Combined modules
angular.module('NewProject', modules)

//Setting up route
.config(['$stateProvider', '$urlRouterProvider',
        function($stateProvider, $urlRouterProvider) {

            // For unmatched routes:
            $urlRouterProvider.otherwise('/');

            // states for my app
            $stateProvider              
                .state('home', {
                    url: '/',
                    templateUrl: 'system/views/index.html'
                })
                .state('comments', {
                	url: '/comments',
                    templateUrl: 'comments/views/index.html'
                });
        }
    ])
    .config(['$locationProvider',
        function($locationProvider) {
            //$locationProvider.html5Mode(true);
            $locationProvider.hashPrefix('!');
        }
    ])

.run();