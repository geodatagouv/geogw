module.exports = function($scope, $http, $routeParams) {
    $scope.protocol = $routeParams.protocol;

    $scope.canBeSynced = function(service) {
        return service.syncEnabled && !service.sync.pending && !service.sync.processing;
    };
    $scope.isNew = function (service) {
        return !service.sync.status || service.sync.status === 'new';
    };
    $scope.syncService = function(service) {
        service.sync.pending = true;
        $http.post('/api/services/' + service._id + '/sync');
    };
    $scope.fetchServices = function(protocol) {
        $http.get('/api/services/by-protocol/' + protocol).success(function(services) {
            $scope.services = services;
        });
    };
    $scope.fetchServices($scope.protocol);
};
