'use strict';

angular.module('mean.notifications').
controller('NotificationModalController', 
    ['$scope', '$stateParams', '$location', 'Global', 'Notifications', '$http', '$modal', '$modalInstance', 'notification',

    function ($scope, $stateParams, $location, Global, Notifications, $http, $modal, $modalInstance, notification) {
    $scope.global = Global;
    $scope.notification = notification;
    $scope.responses = {
        fraccept: 'fraccept',
        frreject: 'frreject',
        craccept: 'craccept',
        crreject: 'crreject'
    };

    //These will vary by type

    $scope.ok = function (notification) {
        $modalInstance.close(notification, 'ok');
    };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };

    $scope.dismiss = function(type) {
        //remove notification
        $modalInstance.dismiss(type);
        console.log(type);
    };

}]);