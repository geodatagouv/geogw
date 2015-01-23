var _ = require('lodash');

var facetsDef = [
    {
        name: 'type',
        label: 'Type de résultat',
        valueLabels: {
            dataset: 'Jeu de données',
            service: 'Service',
            map: 'Carte',
            other: 'Autre',
            none: 'Non renseigné'
        }
    },
    {
        name: 'representationType',
        label: 'Type de donnée',
        valueLabels: {
            vector: 'Vecteur',
            grid: 'Imagerie / Raster',
            other: 'Autre',
            none: 'Non renseigné'
        }
    },
    {
        name: 'opendata',
        label: 'Donnée ouverte',
        valueLabels: {
            yes: 'Oui'
        }
    },
    {
        name: 'availability',
        label: 'Disponibilité',
        valueLabels: {
            yes: 'Oui',
            'true': 'Oui'
        }
    },
    {
        name: 'organization',
        label: 'Organismes'
    },
    {
        name: 'keyword',
        label: 'Mot-clés'
    },
    {
        name: 'distributionFormat',
        label: 'Format de distribution',
        valueLabels: {
            wfs: 'WFS'
        }
    }
];

module.exports = function ($scope, $http, $routeParams, $location) {
    $http.get('/api/services/' + $routeParams.serviceId).success(function(data) {
        $scope.service = data;
    });

    function buildQueryString() {
        if (!$scope.datasets) {
            return _.pick($routeParams, 'organization', 'keyword', 'type', 'representationType', 'opendata', 'availability', 'distributionFormat', 'q', 'offset');
        } else {
            var qs = {};
            $scope.activeFacets.forEach(function (activeFacet) {
                if (!qs[activeFacet.name]) qs[activeFacet.name] = [];
                qs[activeFacet.name].push(activeFacet.value);
            });

            qs.q = $scope.q;
            qs.offset = $scope.offset;

            return qs;
        }
    }

    $scope.fetchDatasets = function() {
        $http
            .get('/api/services/' + $routeParams.serviceId + '/datasets', { params: buildQueryString() })
            .success(function(data) {
                $scope.datasets = data.results;
                $scope.count = data.count;
                $scope.offset = data.query.offset;
                $scope.firstResultPos = data.query.offset + 1;
                $scope.lastResultPos = data.query.offset + data.results.length;
                $scope.activeFacets = data.query.facets;
                $scope.computeFacets(data.facets);
            });
    };

    $scope.computeFacets = function (facets) {
        $scope.facets = _.map(facetsDef, function(def) {
            return { name: def.name, label: def.label, values: facets[def.name], valueLabels: def.valueLabels };
        });
    };

    $scope.updateResults = function (paginate) {
        if (!paginate) $scope.offset = null;
        $location.search(buildQueryString());
        $scope.fetchDatasets();
    };

    $scope.hasPreviousResults = function() {
        return $scope.datasets && ($scope.offset > 0);
    };

    $scope.hasNextResults = function() {
        return $scope.datasets && ($scope.offset + $scope.datasets.length < $scope.count);
    };

    $scope.paginatePrevious = function() {
        $scope.offset = $scope.offset - 20;
        $scope.updateResults(true);
    };

    $scope.paginateNext = function() {
        $scope.offset = $scope.offset + 20;
        $scope.updateResults(true);
    };

    $scope.toggleFacet = function (facet) {
        if (!$scope.facetIsActive(facet)) {
            $scope.activeFacets.push(facet);
        } else {
            _.remove($scope.activeFacets, facet);
        }
        $scope.updateResults();
    };

    $scope.facetIsActive = function (facet) {
        return _.find($scope.activeFacets, facet);
    };

    $scope.$watch('q', $scope.updateResults, true);
    $scope.fetchDatasets();
};
