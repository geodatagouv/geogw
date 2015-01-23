/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Record = mongoose.model('Record');
var Service = mongoose.model('Service');
var async = require('async');
var _ = require('lodash');
var ogr2ogr = require('ogr2ogr');
var url = require('url');

var jobs = require('../kue').jobs;

/*
** Middlewares
*/
exports.dataset = function(req, res, next, id) {
    Record
        .findById(id)
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

exports.downloadRelatedResource = function (req, res, next) {
    var resource = _.find(req.dataset.relatedServices, function (rs) {
        return rs.protocol === 'wfs' && rs.status === 'ok' && rs._id.toString() === req.params.resourceId;
    });

    if (!resource) return res.status(404).end();

    Service.findById(resource.service).exec(function (err, service) {
        if (err) return next(err);
        if (!service) return res.status(500).end();

        res.type('json');

        var wfsLocation = url.parse(service.location);
        wfsLocation.query = service.locationOptions.query;

        ogr2ogr('WFS:' + url.format(wfsLocation))
            .timeout(60000)
            .project('EPSG:4326')
            .options([resource.name])
            .stream()
            .pipe(res);
    });
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
    limit = _.isNumber(limit) && limit > 0 && limit <= 100 ? Math.floor(limit) : 20;
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
                    outputFacets.keyword = outputFacets.keyword ? _.first(outputFacets.keyword, 20) : [];
                    outputFacets.organization = outputFacets.organization ? _.first(outputFacets.organization, 20) : [];
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
            recordId: req.dataset.identifier,
            catalogId: req.dataset.parentCatalog
        })
        .removeOnComplete(true)
        .attempts(5)
        .save(function (err) {
            if (err) return next(err);
            res.status(200).end();
        });
};
