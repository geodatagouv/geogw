var _ = require('lodash');

var types = {
    dataset: 'dataset',
    map: 'map',
    nonGeographicDataset: 'dataset',
    series: 'dataset',
    service: 'service'
};

var representationTypes = {
    grid: 'grid',
    vector: 'vector'
};

var markedAsOpenKeywords = [
    'donnée ouverte',
    'données ouvertes',
    'opendata',
    'open data'
];

exports.compute = function (record) {

    var facets = [];

    function mapToFacet(name, mapping, recordAttribute) {
        var value = record.get(recordAttribute);
        var facet = { name: name };

        if (!value) {
            facet.value = 'none';
        } else if (value in mapping) {
            facet.value = mapping[value];
        } else {
            facet.value = 'other';
        }

        facets.push(facet);
    }

    mapToFacet('type', types, 'metadata.type');
    mapToFacet('representationType', representationTypes, 'metadata.representationType');

    function addToFacet(name, recordAttribute) {
        var values = record.get(recordAttribute);

        if (!values || values.length === 0) {
            facets.push({ name: name, value: 'none' });
            return;
        }

        _.uniq(values).forEach(function (value) {
            facets.push({ name: name, value: value });
        });
    }

    addToFacet('organization', 'organizations');
    addToFacet('keyword', 'metadata.keywords');

    // Marked as open
    var markedAsOpen = _.find(record.get('metadata.keywords'), function (keyword) {
        return markedAsOpenKeywords.indexOf(keyword.toLowerCase()) >= 0;
    });
    if (markedAsOpen) {
        facets.push({ name: 'opendata', value: 'yes' });
    }

    // Distribution formats
    var wfs = _.find(record.get('relatedServices'), function (relatedService) {
        return relatedService.protocol === 'wfs';
    });
    if (wfs) {
        facets.push({ name: 'distributionFormat', value: 'wfs' });
    }

    // Availability
    var availability = _.find(record.get('relatedServices'), function (relatedService) {
        return relatedService.protocol === 'wfs' && relatedService.status === 'ok';
    });
    if (availability) {
        facets.push({ name: 'availability', value: 'true' });
    }

    record.set('facets', facets);
};
