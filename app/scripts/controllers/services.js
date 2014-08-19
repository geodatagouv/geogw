module.exports = function($scope, $http, $routeParams, SessionService) { // $timeout
    $scope.protocol = $routeParams.protocol;

    $scope.isLoggedIn = SessionService.isLoggedIn();

    $scope.$on('userLoggedIn', function() {
        $scope.isLoggedIn = true;
    });

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
            // $timeout($scope.fetchServices, 2000);
        });
    };
    $scope.initNewService = function() {
        $scope.newService = { protocol: 'csw' };
    };
    $scope.saveNewService = function() {
        $http.post('/api/services', $scope.newService).success(function() {
            delete $scope.newService;
        });
    };
    $scope.fetchServices($scope.protocol);
};
