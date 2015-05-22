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
    'donnee-ouverte',
    'donnees-ouvertes',
    'donnee-ouvertes',
    'donnees-ouverte',
    'opendata',
    'open-data'
];

function compute(record) {

    var facets = [];

    function mapToFacet(name, mapping, recordAttribute) {
        var value = _.get(record, recordAttribute);
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
        var values = _.get(record, recordAttribute);

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
    var markedAsOpen = _.find(_.get(record, 'metadata.keywords', []), function (keyword) {
        return markedAsOpenKeywords.indexOf(_.kebabCase(keyword)) >= 0;
    });
    var parentCatalogId = record.parentCatalog.toString();
    if (markedAsOpen || parentCatalogId === '53a01c3c23a9836106440e0f' || parentCatalogId === '547c93503da4a1c26e329435') {
        facets.push({ name: 'opendata', value: 'yes' });
    }

    // Distribution formats
    var wfs = _.find(_.get(record, 'dataset.distributions'), function (distribution) {
        return distribution.type === 'wfs-featureType';
    });
    if (wfs) {
        facets.push({ name: 'distributionFormat', value: 'wfs' });
    }

    // Availability
    var availability = _.find(_.get(record, 'dataset.distributions'), function (distribution) {
        return distribution.available;
    });
    if (availability) {
        facets.push({ name: 'availability', value: 'true' });
    }

    return facets;
}

exports.compute = compute;
