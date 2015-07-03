var mongoose = require('mongoose');
var Record = mongoose.model('Record');
var async = require('async');
var _ = require('lodash');

module.exports = function (searchQuery, done) {
    var q = searchQuery.q && _.isString(searchQuery.q) && searchQuery.q.length ? searchQuery.q : null;
    var limit = parseInt(searchQuery.limit);
    limit = _.isNumber(limit) && limit > 0 && limit <= 500 ? Math.floor(limit) : 20;
    var offset = parseInt(searchQuery.offset);
    offset = _.isNumber(offset) && offset > 0 ? Math.floor(offset) : 0;

    var query = { parentCatalog: mongoose.Types.ObjectId(searchQuery.catalog) };

    // Text search
    if (q) {
        query.$text = { $search: searchQuery.q, $language: 'french' };
    }

    // Facets
    var facetKeys = ['organization', 'type', 'keyword', 'representationType', 'opendata', 'distributionFormat', 'availability'];
    var facets = [];
    facetKeys.forEach(function (facetKey) {
        if (!(facetKey in searchQuery)) return;

        var values = _.isArray(searchQuery[facetKey]) ? searchQuery[facetKey] : [searchQuery[facetKey]];
        values.forEach(function (value) {
            facets.push({ name: facetKey, value: value });
        });
    });

    if (facets.length > 0) {
        query.facets = {
            $all: facets.map(function (facet) {
                return { $elemMatch: facet };
            })
        };
    }

    async.parallel({
        results: function (callback) {
            Record.find(query)
                .select({ score: { $meta: 'textScore' }, facets: 0 }) // TODO: $meta seems to break selection :/
                .sort({ score: { $meta: 'textScore' } })
                .skip(offset)
                .limit(limit)
                .exec(callback);
        },
        count: function (callback) {
            Record.count(query).exec(callback);
        },
        facets: function (cb) {
            Record
                .aggregate([
                    { $match: query },
                    { $unwind: '$facets' },
                    { $group: { _id: { name: '$facets.name', value: '$facets.value' }, count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ])
                .exec(function (err, result) {
                    if (err) return cb(err);
                    var outputFacets = {};
                    result.forEach(function (facet) {
                        if (!outputFacets[facet._id.name]) outputFacets[facet._id.name] = [];
                        outputFacets[facet._id.name].push({
                            value: facet._id.value,
                            count: facet.count
                        });
                    });
                    if (!searchQuery.facets) searchQuery.facets = { organization: 20, keyword: 20 };
                    _.forEach(outputFacets, function (facetList, facetName) {
                        if (facetName in searchQuery.facets) {
                            if (parseInt(searchQuery.facets[facetName]) === 0) {
                                outputFacets[facetName] = undefined;
                                return;
                            }
                            outputFacets[facetName] = _.take(outputFacets[facetName], searchQuery.facets[facetName]);
                        }
                    });
                    cb(null, outputFacets);
                });
        }
    }, function(err, output) {
        if (err) return done(err);
        output.query = { q: q, facets: facets, limit: limit, offset: offset };
        done(null, output);
    });
};
