/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Record = mongoose.model('Record');
var async = require('async');
var _ = require('lodash');

var jobs = require('../kue').jobs;

/*
** Middlewares
*/
exports.dataset = function(req, res, next, id) {
    Record
        .findOne({ parentCatalog: req.params.serviceId, hashedId: id })
        .exec(function(err, dataset) {
            if (err) return next(err);
            if (!dataset) return res.status(404).end();
            req.dataset = dataset;
            next();
        });
};

/*
** Actions
*/
exports.show = function(req, res) {
    res.send(req.dataset);
};

exports.findByIdentifier = function(req, res, next) {
    Record
        .find({ identifier: req.params.identifier })
        .populate('parentCatalog')
        .exec(function(err, datasets) {
            if (err) return next(err);
            res.send(datasets);
        });
};

exports.search = function(req, res, next) {
    var q = req.query.q && _.isString(req.query.q) && req.query.q.length ? req.query.q : null;
    var limit = parseInt(req.query.limit);
    limit = _.isNumber(limit) && limit > 0 && limit <= 500 ? Math.floor(limit) : 20;
    var offset = parseInt(req.query.offset);
    offset = _.isNumber(offset) && offset > 0 ? Math.floor(offset) : 0;

    var query = { parentCatalog: req.service._id };

    // Text search
    if (q) {
        query.$text = { $search: req.query.q, $language: 'french' };
    }

    // Facets
    var facetKeys = ['organization', 'type', 'keyword', 'representationType', 'opendata', 'distributionFormat', 'availability'];
    var facets = [];
    facetKeys.forEach(function (facetKey) {
        if (!(facetKey in req.query)) return;

        var values = _.isArray(req.query[facetKey]) ? req.query[facetKey] : [req.query[facetKey]];
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
                    if (!req.query.facets) req.query.facets = { organization: 20, keyword: 20 };
                    _.forEach(outputFacets, function (facetList, facetName) {
                        if (facetName in req.query.facets) {
                            if (parseInt(req.query.facets[facetName]) === 0) {
                                outputFacets[facetName] = undefined;
                                return;
                            }
                            outputFacets[facetName] = _.take(outputFacets[facetName], req.query.facets[facetName]);
                        }
                    });
                    cb(null, outputFacets);
                });
        }
    }, function(err, output) {
        if (err) return next(err);
        output.query = { q: q, facets: facets, limit: limit, offset: offset };
        res.json(output);
    });
};

exports.forceReprocess = function (req, res, next) {
    jobs
        .create('process-record', {
            hashedId: req.dataset.hashedId,
            catalogId: req.dataset.parentCatalog
        })
        .removeOnComplete(true)
        .attempts(5)
        .save(function (err) {
            if (err) return next(err);
            res.status(200).end();
        });
};
