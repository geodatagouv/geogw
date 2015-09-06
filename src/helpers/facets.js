var _ = require('lodash');
var _s = require('underscore.string');

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

function compute(record, catalogs = []) {

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

    /* Catalog names */
    _(catalogs).chain()
        .compact()
        .pluck('name')
        .uniq()
        .value()
        .forEach(catalogName => facets.push({ name: 'catalog', value: catalogName }));

    var keywords = _.get(record, 'metadata.keywords', []);
    var kcKeywords = keywords.map(function (keyword) {
        return _.kebabCase(keyword);
    });

    /* Dataset marked as open */
    // Detect PRODIGE usual keywords
    var markedAsOpen = _s.include(kcKeywords, 'grand-public') &&
        (_s.include(kcKeywords, 'non-restreint') || _s.include(kcKeywords, 'ouvert'));
    // Detect official keyword and variations (CNIG)
    markedAsOpen = markedAsOpen || _.find(kcKeywords, function (keyword) {
        return markedAsOpenKeywords.indexOf(keyword) >= 0;
    });
    //var parentCatalogId = record.parentCatalog.toString();
    // Specific detection for Data EauFrance catalog (TO BE REMOVED)
    // markedAsOpen = markedAsOpen || parentCatalogId === '53a01c3c23a9836106440e0f';
    facets.push({ name: 'opendata', value: markedAsOpen ? 'yes' : 'not-determined' });

    // Distribution formats
    _(_.get(record, 'dataset.distributions', []))
        .pluck('type')
        .uniq()
        .value()
        .forEach(function (type) {
            facets.push({ name: 'distributionFormat', value: type });
        });

    // Availability
    var availability = _.find(_.get(record, 'dataset.distributions'), function (distribution) {
        return distribution.available;
    });
    facets.push({ name: 'availability', value: availability ? 'yes' : 'not-determined' });

    return facets;
}

exports.compute = compute;
