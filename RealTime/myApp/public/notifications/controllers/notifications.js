'use strict';

angular.module('mean.notifications').
controller('NotificationsController', 
    ['$scope', '$stateParams', '$location', 'Global', 'Notifications', '$http', '$modal', '$log',

    function ($scope, $stateParams, $location, Global, Notifications, $http, $modal, $log) {
    $scope.global = Global;

    $scope.create = function() {

        var notification = new Notifications({
            subject: this.subject,
            content: this.content,
            to: this.userIds,
            type: this.type
        });
        notification.$save(function(response) {
            $scope.find();
        });

        this.subject = '';
        this.content = '';
    };

    $scope.remove = function(notification) {
        if (notification) {
            notification.$remove();

            for (var i in $scope.notifications) {
                if ($scope.notifications[i] === notification) {
                    $scope.notifications.splice(i, 1);
                }
            }
        }
        else {
            $scope.notification.$remove();
            $location.path('notifications');
        }
    };

    $scope.update = function() {
        var notification = $scope.notification;
        if (!notification.updated) {
            notification.updated = [];
        }
        notification.updated.push(new Date().getTime());

        notification.$update(function() {
            $location.path('notifications/' + notification._id);
        });
    };

    $scope.find = function() {

        $http({
            method:'GET',
            url:'/notifications'
        }).success(function(data) {
            $scope.notifications = data;
        })

        $http({
            method:'GET',
            url:'/users'
        }).success(function(data) {
            $scope.users = data;
        })
    };

    $scope.selected = function() {
        var userIds = [];
        for (var i =0; i < this.to.length; i++) {
            userIds.push(this.to[i]._id);
        }

        $scope.userIds = userIds;

    };

    //Notification Handlers
    var notificationType = {
        'friendrequest': 'public/notifications/views/modals/friendrequest.html',
        'general': 'public/notifications/views/modals/general.html',
        'collabrequest': 'public/notifications/views/modals/collabrequest.html',
    };

    var dismissType = {
        'fraccept': fraccept,
        'frreject': frreject,
        'craccept': craccept,
        'crreject': crreject,
    };

    $scope.open = function (notification) {

        function markAsRead(notification) {
            $http({
                method: 'POST',
                url: '/notifications/' + notification._id + '/markasread'
            }).success(function(data) {
                console.log(data);
                for (var i = 0; i < $scope.notifications.length; i++) {
                    if ($scope.notifications[i]._id == data._id) {
                        $scope.notifications[i] = data;
                    }
                }
            }).error(function(data) {
                //error
            });
        }

        markAsRead(notification);

        var modalInstance = $modal.open({
          templateUrl: notificationType[notification.type],
          controller: 'NotificationModalController',
          notification: notification,
          resolve: {
            notification: function () {
              return notification;
            }
          }
        });

        modalInstance.result.then(function (notification) {

        }, function (reason) {  //rejected
            $log.info('Modal dismissed at: ' + new Date() + " reason: " + reason);
            if (dismissType.hasOwnProperty(reason)) {
                dismissType[reason](notification);
            }
        });
    };

    function fraccept(notification) {
        //handle fr accept
        $http({
            method: 'POST',
            url: '/notifications/friendrequest/' + notification._id + '/accept'
        }).success(function(data) {
            console.log(data);

        }).error(function(data) {
            //error
        });
    }

    function frreject(notification) {
        //handle fr accept
        $http({
            method: 'POST',
            url: '/notifications/friendrequest/' + notification._id + '/reject'
        }).success(function(data) {
            console.log(data);

        }).error(function(data) {
            //error
        });
    }

    function craccept(notification) {
        //handle cr accept
        $http({
            method: 'POST',
            url: '/notifications/collabrequest/' + notification._id + '/accept'
        }).success(function(data) {
            console.log(data);

        }).error(function(data) {
            //error
        });
    }

    function crreject(notification) {
        //handle cr reject
        $http({
            method: 'POST',
            url: '/notifications/collabrequest/' + notification._id + '/reject'
        }).success(function(data) {
            console.log(data);

        }).error(function(data) {
            //error
        });
    }



    $scope.hasSeen = function(notification, userId) {
        if (!notification.seen) {
            return false;
        } else {
            return notification.seen.indexOf(userId) > -1 ? true : false;
        }
    };




}]);