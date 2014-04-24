'use strict';

angular.module('mean').config(['$stateProvider',
    function($stateProvider) {
        $stateProvider.state('mymodule example page', {
            url: '/mymodule/example',
            templateUrl: 'mymodule/views/index.html'
        });
    }
]);
