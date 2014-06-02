var mainApp = angular.module('mainApp',[]);

mainApp.controller('MainController', function ($scope, $http, $timeout) {
    $scope.selectedServices = [];
    $scope.harvest = function(service) {
        $http.post('/api/services/' + service._id + '/harvest');
    };
    $scope.fetchServices = function() {
        $http.get('/api/services').success(function(services) {
            $scope.services = services;
            if (!$scope.selectedServices.length && services.length) $scope.toggleSelection(services[0]);
            $timeout($scope.fetchServices, 2000);
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
    $scope.toggleSelection = function(service) {
        // var index = $scope.selectedServices.indexOf(service._id);
        // if (index === -1) {
        //     $scope.selectedServices.push(service._id);
        // } else {
        //     $scope.selectedServices.splice(index, 1);
        // }
        $scope.selectedServices = [service._id];
        $scope.fetchDatasets();
    };
    $scope.isSelected = function(service) {
        return $scope.selectedServices.indexOf(service._id) !== -1;
    };
    $scope.fetchDatasets = function() {
        if ($scope.selectedServices.length === 0) return;
        $http
            .get('/api/services/' + $scope.selectedServices[0] + '/datasets', { params: { q: $scope.q, opendata: $scope.opendata } })
            .success(function(data) {
                $scope.datasets = data.results;
                $scope.datasetsCount = data.count;
            });
    };
    $scope.hasKeywordOpenData = function(dataset) {
        return dataset.metadata.keywords && (dataset.metadata.keywords.indexOf('données ouvertes') >= 0 || dataset.metadata.keywords.indexOf('donnée ouverte') >= 0 || dataset.metadata.keywords.indexOf('opendata') >= 0);
    };
    $scope.$watchGroup(['q', 'opendata'], function() {
        $scope.fetchDatasets();
    });
    $scope.fetchServices();
});
