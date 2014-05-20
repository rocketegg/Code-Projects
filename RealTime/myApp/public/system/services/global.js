'use strict';

//Global service for global variables
angular.module('mean.system').service('Global', ['$rootScope', 
    function($rootScope) {
    	console.log($rootScope);
    	var data = {
    		blah: 'blah',
    		user: $rootScope.user,
    		authenticated: !! $rootScope.user
    	}

    	$rootScope.$on('loggedin', function() {
    		data.user = $rootScope.user;
    		data.authenticated = !! $rootScope.user;
    	});

	    return data;
    }


]);