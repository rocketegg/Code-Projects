'use strict';

//Articles service used for articles REST endpoint
angular.module('mean.notifications').factory('Notifications', ['$resource', function($resource) {
    return $resource('notifications/:notificationId', {
        articleId: '@_id'
    }, {
        update: {
            method: 'PUT'
        }
    });
}]);