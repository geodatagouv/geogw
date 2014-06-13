var mainApp = angular.module('mainApp', ['ngRoute']);

mainApp.config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);
    $routeProvider
        .when('/services', {
            templateUrl: '/partials/services.html',
            controller: 'ServicesCtrl'
        })
        .when('/services/:serviceId/datasets', {
            templateUrl: '/partials/datasets.html',
            controller: 'ServiceDatasetsCtrl'
        })
        .otherwise({
            redirectTo: '/services'
        });
});

mainApp.controller('ServicesCtrl', function($scope, $http, $timeout) {
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
    $scope.fetchServices();
});

mainApp.controller('ServiceDatasetsCtrl', function ($scope, $http, $routeParams) {
    $http.get('/api/services/' + $routeParams.serviceId).success(function(data) {
        $scope.service = data;
    });
    $scope.fetchDatasets = function() {
        $http
            .get('/api/services/' + $routeParams.serviceId + '/datasets', { params: { q: $scope.q, opendata: $scope.opendata } })
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
    $scope.fetchDatasets();
});
