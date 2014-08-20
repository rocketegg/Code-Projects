'use strict';

angular.element(document).ready(function() {
	//Fixing facebook bug with redirect
	if (window.location.hash === '#_=_') window.location.hash = '#!';

	//Then init the app
	angular.bootstrap(document, ['mean']);

});

// Dynamically add angular modules declared by packages
var packageModules = [];
for (var index in window.modules) {
	angular.module(window.modules[index].module, (window.modules[index].angularDependencies?window.modules[index].angularDependencies:[]));
	packageModules.push(window.modules[index].module);
};

// Default modules
var modules = ['ngCookies', 'ngResource', 'ui.bootstrap', 'ui.router', 'mean.system', 'mean.articles', 'mean.auth', 'googlechart', 'ngSanitize', 'ngSlider', 'ui.multiselect', 'ui.utils'];
modules = modules.concat(packageModules);

var ignorestates = [
    'auth.login',
    'auth.register'
];

// Combined modules
angular.module('mean', modules)

.run(function ($rootScope, $state, Global, $http, $timeout, $location, $q) {
	$rootScope.$on("$stateChangeStart", function(event, toState, toParams, fromState, fromParams){
        console.log(toState.name);
        if (ignorestates.indexOf(toState.name) === -1) {
    		$http.get('/loggedin').success(function(user) {
                // Authenticated
                if (user !== '0') {
                	console.log("User is logged in, setting global var");
                	$rootScope.user = user;
                    console.log(user);
                	$rootScope.$emit('loggedin');
                }

                // Not Authenticated
                else {
                    if (toState.name !== 'home') {
                        $timeout(function() {
                            event.preventDefault();
                            $location.url('/login');
                        }, 0);
                    }
                }
            });
        } else {

        }
	});
});
