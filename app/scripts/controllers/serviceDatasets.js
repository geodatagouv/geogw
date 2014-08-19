var _ = require('lodash');

module.exports = function ($scope, $http, $routeParams, $location) {
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

    $scope.updateResults = function(oldValue, newValue) {
        if (oldValue.q !== newValue.q || oldValue.opendata !== newValue.opendata) $scope.searchContext.offset = 0;
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
};
