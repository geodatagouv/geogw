var moment = require('moment');
var _ = require('lodash');

module.exports = function($scope, $http, $routeParams) {
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
    $http.get('/api/services/' + $routeParams.serviceId + '/datasets/' + $routeParams.datasetId).success(function(dataset) {
        $scope.dataset = dataset;

        $http.get('/api/datasets/by-identifier/' + dataset.identifier).success(function(otherDatasets) {
            $scope.sameIdentifierDatasets = _.reject(otherDatasets, { _id: dataset._id });
            if ($scope.sameIdentifierDatasets.length === 0) return;
            var mostRecent = _.max($scope.sameIdentifierDatasets, function(d) { return moment(d.metadata._updated); });
            if (mostRecent.metadata._updated > dataset.metadata._updated) $scope.moreRecent = mostRecent;
        });

        $http
            .get('/api/catalogs/' + $routeParams.serviceId + '/records/' + encodeURIComponent(dataset.identifier) + '/history')
            .success(function (records) {
                $scope.archivedRecords = records;
            });
    });
    $http.get('/api/services/' + $routeParams.serviceId).success(function(data) {
        $scope.service = data;
    });
    $scope.encodeURIComponent = encodeURIComponent;
    $scope.forceReprocess = function () {
        $http.post('/api/services/' + $routeParams.serviceId + '/datasets/' + $routeParams.datasetId + '/force-reprocess').success(function () {
            // Do nothing
        });
    };
};
