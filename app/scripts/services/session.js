module.exports = function($http, $rootScope) {
    var user;

    var markAsLoggedOut = function() {
        user = null;
        delete sessionStorage.user;
    };

    return {
        init: function() {
            user = sessionStorage.user;
        },

        isLoggedIn: function() {
            return angular.isObject(user);
        },

        getUser: function() {
            return user;
        },

        fetch: function() {
            return $http.get('/api/profile').success(function(_user) {
                user = _user;
                sessionStorage.user = _user;
                $rootScope.$broadcast('userLoggedIn', user);
            }).error(function(data, status) {
                if (status === 401) {
                    markAsLoggedOut();
                }
            });
        },

        logout: function() {
            markAsLoggedOut();
            // return $http.post('/api/logout');
        }
    };
};
