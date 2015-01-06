module.exports = function($scope, $http, $routeParams) {
    $scope.protocol = $routeParams.protocol;

    $scope.canBeSynced = function(service) {
        return service.syncable && (!service.lastSync || service.lastSync.status === 'successful' || service.lastSync.status === 'failed');
    };
    $scope.syncService = function(service) {
        if (!service.lastSync) service.lastSync = {};
        service.lastSync.status = 'queued';
        $http.post('/api/services/' + service._id + '/sync');
    };
    $scope.fetchServices = function(protocol) {
        $http.get('/api/services/by-protocol/' + protocol).success(function(services) {
            $scope.services = services;
        });
    };
    $scope.fetchServices($scope.protocol);
};
