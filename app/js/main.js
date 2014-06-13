angular.module('customFilters', []).filter('prune', function () {
    return function (value, max) {
        if (!value) return '';

        max = parseInt(max, 10);
        if (!max) return value;
        if (value.length <= max) return value;

        return _.str.prune(value, max)
    };
});

var mainApp = angular.module('mainApp', ['ngRoute', 'customFilters']);

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

    var offset = $routeParams.offset || 0;

    $scope.fetchDatasets = function() {
        $http
            .get('/api/services/' + $routeParams.serviceId + '/datasets', { params: {
                offset: offset,
                q: $scope.q,
                opendata: $scope.opendata
            } })
            .success(function(data) {
                $scope.datasets = data.results;
                $scope.datasetsCount = data.count;

                delete $scope.previousLink;
                delete $scope.nextLink;

                if (data.offset + data.results.length < data.count) {
                    $scope.nextLink = '?offset=' + (data.offset + 20);
                }
                if (data.offset > 0) {
                    $scope.previousLink = '?offset=' + (data.offset - 20);
                }
            });
    };

    $scope.hasKeywordOpenData = function(dataset) {
        return dataset.metadata.keywords && (dataset.metadata.keywords.indexOf('données ouvertes') >= 0 || dataset.metadata.keywords.indexOf('donnée ouverte') >= 0 || dataset.metadata.keywords.indexOf('opendata') >= 0);
    };

    function searchIfUpdated(newValue, oldValue) {
        if (newValue !== oldValue) {
            offset = 0;
            $scope.fetchDatasets();
        }
    }

    $scope.$watch('q', searchIfUpdated);
    $scope.$watch('opendata', searchIfUpdated);

    $scope.fetchDatasets();
});
