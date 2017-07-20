'use strict';

const { get, uniq, chain } = require('lodash');

const types = {
    dataset: 'dataset',
    map: 'map',
    nonGeographicDataset: 'nonGeographicDataset',
    series: 'dataset',
    service: 'service',
};

const representationTypes = {
    grid: 'grid',
    vector: 'vector',
    raster: 'grid',
};

function compute(record, { catalogs, publications }) {

    var facets = [];

    function mapToFacet(name, mapping, recordAttribute) {
        var value = get(record, recordAttribute);
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
    mapToFacet('representationType', representationTypes, 'metadata.spatialRepresentationType');

    function addToFacet(name, recordAttribute) {
        var values = get(record, recordAttribute);

        if (!values || values.length === 0) {
            facets.push({ name: name, value: 'none' });
            return;
        }

        uniq(values).forEach(function (value) {
            facets.push({ name: name, value: value });
        });
    }

    addToFacet('organization', 'organizations');
    addToFacet('keyword', 'metadata.keywords');

    facets.push({ name: 'metadataType', value: record.metadata.metadataType });

    /* Catalog names */
    chain(catalogs || [])
        .compact()
        .map(c => c.name)
        .uniq()
        .value()
        .forEach(catalogName => facets.push({ name: 'catalog', value: catalogName }));

    /* Dataset marked as open */
    const openDataLicense = record.metadata.license === 'fr-lo' || record.metadata.license === 'odc-odbl';
    facets.push({ name: 'opendata', value: openDataLicense ? 'yes' : 'not-determined' });

    // Distribution formats
    chain(get(record, 'dataset.distributions', []))
        .map(dist => dist.type)
        .uniq()
        .value()
        .forEach(function (type) {
            facets.push({ name: 'distributionFormat', value: type });
        });

    // Availability
    const availability = get(record, 'dataset.distributions').find(function (distribution) {
        return distribution.available;
    });
    facets.push({ name: 'availability', value: availability ? 'yes' : 'not-determined' });

    // Publications
    facets.push({
        name: 'dgvPublication',
        value: publications.some(p => p.target === 'dgv') ? 'yes' : 'no'
    });

    return facets;
}

exports.compute = compute;
