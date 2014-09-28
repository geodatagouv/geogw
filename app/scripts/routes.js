module.exports = function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode({ enabled: true, requireBase: false });
    $routeProvider
        .when('/services/by-protocol/:protocol', {
            templateUrl: '/partials/services.html',
            controller: 'ServicesCtrl'
        })
        .when('/services/:serviceId/datasets', {
            templateUrl: '/partials/datasets.html',
            controller: 'ServiceDatasetsCtrl',
            reloadOnSearch: false
        })
        .when('/services/:serviceId/datasets/:datasetId', {
            templateUrl: '/partials/dataset.html',
            controller: 'DatasetCtrl'
        })
        .otherwise({
            redirectTo: '/services/by-protocol/csw'
        });
};
