'use strict';

angular.module('mean').controller('MymoduleController', ['$scope', 'Global',
    function($scope, Global, Mymodule) {
        $scope.global = Global;
        $scope.mymodule = {
            name: 'mymodule'
        };
    }
]);
