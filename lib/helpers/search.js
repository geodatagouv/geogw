/* eslint comma-dangle: [2, "always-multiline"] */
const mongoose = require('mongoose');
const { parallel } = require('async');
const { isString, isNumber, isArray, clone, forEach, take } = require('lodash');
const { formatMany } = require('../formatters/records');

const ConsolidatedRecord = mongoose.model('ConsolidatedRecord');

module.exports = function (searchQuery, catalogName, done) {
    if (!done) {
        done = catalogName;
        catalogName = undefined;
    }

    var q = searchQuery.q && isString(searchQuery.q) && searchQuery.q.length ? searchQuery.q : null;
    var limit = parseInt(searchQuery.limit);
    limit = isNumber(limit) && limit > 0 && limit <= 500 ? Math.floor(limit) : 20;
    var offset = parseInt(searchQuery.offset);
    offset = isNumber(offset) && offset > 0 ? Math.floor(offset) : 0;

    var query = {};

    // Text search
    if (q) {
        query.$text = { $search: searchQuery.q, $language: 'french' };
    }

    // Facets
    var facetKeys = [
        'organization',
        'type', 'keyword',
        'representationType',
        'opendata',
        'distributionFormat',
        'availability',
        'metadataType',
        'dgvPublication',
    ];
    if (!catalogName) facetKeys.push('catalog');

    var facetsFromQuery = [];
    facetKeys.forEach(function (facetKey) {
        if (!(facetKey in searchQuery)) return;

        var values = isArray(searchQuery[facetKey]) ? searchQuery[facetKey] : [searchQuery[facetKey]];
        values.forEach(function (value) {
            facetsFromQuery.push({ name: facetKey, value: value });
        });
    });

    const facetsToUse = clone(facetsFromQuery);

    if (catalogName) {
        facetsToUse.push({ name: 'catalog', value: catalogName });
    }

    if (facetsToUse.length > 0) {
        query.facets = {
            $all: facetsToUse.map(function (facet) {
                return { $elemMatch: facet };
            }),
        };
    }

    parallel({
        results: function (callback) {
            ConsolidatedRecord.find(query)
                .select({ score: { $meta: 'textScore' }, facets: 0 }) // TODO: $meta seems to break selection :/
                .sort({ score: { $meta: 'textScore' } })
                .skip(offset)
                .limit(limit)
                .lean()
                .exec(callback);
        },
        count: function (callback) {
            ConsolidatedRecord.count(query).exec(callback);
        },
        facets: function (cb) {
            ConsolidatedRecord
                .aggregate([
                    { $match: query },
                    { $unwind: '$facets' },
                    { $group: { _id: { name: '$facets.name', value: '$facets.value' }, count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ])
                .exec(function (err, result) {
                    if (err) return cb(err);
                    var outputFacets = {};
                    result.forEach(function (facet) {
                        if (catalogName && facet._id.name === 'catalog') return;
                        if (!outputFacets[facet._id.name]) outputFacets[facet._id.name] = [];
                        outputFacets[facet._id.name].push({
                            value: facet._id.value,
                            count: facet.count,
                        });
                    });
                    if (!searchQuery.facets) searchQuery.facets = { organization: 20, keyword: 20, catalog: 20 };
                    forEach(outputFacets, function (facetList, facetName) {
                        if (facetName in searchQuery.facets) {
                            if (parseInt(searchQuery.facets[facetName]) === 0) {
                                outputFacets[facetName] = undefined;
                                return;
                            }
                            outputFacets[facetName] = take(outputFacets[facetName], searchQuery.facets[facetName]);
                        }
                    });
                    cb(null, outputFacets);
                });
        },
    }, function(err, output) {
        if (err) return done(err);
        output.results = formatMany(output.results);
        output.query = { q: q, facets: facetsFromQuery, limit: limit, offset: offset };
        done(null, output);
    });
};
