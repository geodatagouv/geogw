var customFilters = angular.module('customFilters', []);

customFilters.filter('duration', function () {
    return function (value) {
        if (!value) return '';
        return moment.duration(value).humanize();
    };
});

customFilters.filter('timeago', function () {
    return function (value) {
        if (!value) return '';
        return moment(value).fromNow();
    };
});

customFilters.filter('prune', function () {
    return function (value, max) {
        if (!value) return '';

        max = parseInt(max, 10);
        if (!max) return value;
        if (value.length <= max) return value;

        return _.str.prune(value, max);
    };
});

var mainApp = angular.module('mainApp', ['ngRoute', 'customFilters']);

mainApp.config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);
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
});

mainApp.controller('ServicesCtrl', function($scope, $http, $routeParams/*, $timeout*/) {
    $scope.protocol = $routeParams.protocol;

    $scope.session = session;
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
});

mainApp.controller('ServiceDatasetsCtrl', function ($scope, $http, $routeParams, $location) {
    $scope.searchContext = _.pick($routeParams, 'q', 'offset', 'opendata');

    $http.get('/api/services/' + $routeParams.serviceId).success(function(data) {
        $scope.service = data;
    });

    $scope.fetchDatasets = function() {
        $http
            .get('/api/services/' + $routeParams.serviceId + '/datasets', { params: $scope.searchContext })
            .success(function(data) {
                $scope.datasets = data.results;
                $scope.datasetsCount = data.count;
                $scope.offset = data.offset;
                $scope.firstResultPos = data.offset + 1;
                $scope.lastResultPos = data.offset + data.results.length;
            });
    };

    $scope.updateResults = function() {
        $location.search(_.pick($scope.searchContext, 'q', 'opendata', 'offset'));
        $scope.fetchDatasets();
    };

    $scope.hasPreviousResults = function() {
        return $scope.datasets && ($scope.offset > 0);
    };

    $scope.hasNextResults = function() {
        return $scope.datasets && ($scope.offset + $scope.datasets.length < $scope.datasetsCount);
    };

    $scope.paginatePrevious = function() {
        $scope.searchContext.offset = $scope.offset - 20;
        $scope.updateResults();
    };

    $scope.paginateNext = function() {
        $scope.searchContext.offset = $scope.offset + 20;
    };

    $scope.hasKeywordOpenData = function(dataset) {
        return dataset.metadata.keywords && (dataset.metadata.keywords.indexOf('données ouvertes') >= 0 || dataset.metadata.keywords.indexOf('donnée ouverte') >= 0 || dataset.metadata.keywords.indexOf('opendata') >= 0);
    };

    $scope.$watch('searchContext', $scope.updateResults, true);
    $scope.fetchDatasets();
});

mainApp.controller('DatasetCtrl', function($scope, $http, $routeParams) {
    $scope.datasetTypes = {
        series: 'Série de données',
        dataset: 'Jeu de données'
    };
    $scope.contactTypes = {
        resourceProvider: 'Fournisseur',
        custodian: 'Gestionnaire',
        owner: 'Propriétaire',
        user: 'Utilisateur',
        distributor: 'Distributeur',
        originator: 'Commanditaire',
        pointOfContact: 'Point de contact',
        principalInvestigator: 'Maître d\'oeuvre',
        processor: 'Intégrateur',
        publisher: 'Éditeur',
        autor: 'Auteur',
        author: 'Auteur'
    };
    $http.get('/api/datasets/' + $routeParams.datasetId).success(function(dataset) {
        $scope.dataset = dataset;
        $http.get('/api/datasets/by-identifier/' + dataset.identifier).success(function(otherDatasets) {
            $scope.sameIdentifierDatasets = _.reject(otherDatasets, { _id: dataset._id });
            if ($scope.sameIdentifierDatasets.length === 0) return;
            var mostRecent = _.max($scope.sameIdentifierDatasets, function(d) { return moment(d.metadata._updated); });
            if (mostRecent.metadata._updated > dataset.metadata._updated) $scope.moreRecent = mostRecent;
        });
    });
    $http.get('/api/services/' + $routeParams.serviceId).success(function(data) {
        $scope.service = data;
    });
});
