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

var OPENDATA_KEYWORDS = [
    'donnée ouverte',
    'données ouvertes',
    'opendata',
    'open data',
    'Open Data',
    'OpenData',
    'data gouv',
    'etalab'
];

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
    var q, limit, offset, opendata, wfs;
    if (req.query.q && _.isString(req.query.q) && req.query.q.length) q = req.query.q;
    limit = parseInt(req.query.limit);
    limit = _.isNumber(limit) && limit > 0 && limit <= 100 ? Math.floor(limit) : 20;
    offset = parseInt(req.query.offset);
    offset = _.isNumber(offset) && offset > 0 ? Math.floor(offset) : 0;
    opendata = req.query.opendata === 'true';
    wfs = req.query.wfs === 'true';

    function buildQuery() {
        var query = Record.find().where('metadata.type').in(['dataset', 'series', 'nonGeographicDataset']);
        if (q) query.where({ $text: { $search: q, $language: 'french' }});
        if (opendata) query.where('metadata.keywords').in(OPENDATA_KEYWORDS);
        if (wfs) query.where('relatedServices').elemMatch({ status: 'ok', protocol: 'wfs' });
        if (req.service) query.where('parentCatalog', req.service.id);
        return query;
    }

    async.parallel({
        results: function(callback) {
            buildQuery()
                .select({ score: { $meta: 'textScore' } })
                .sort({ score: { $meta: 'textScore' } })
                .skip(offset)
                .limit(limit)
                .exec(callback);
        },
        count: function(callback) {
            buildQuery().count().exec(callback);
        }
    }, function(err, out) {
        if (err) return next(err);
        out.limit = limit;
        out.offset = offset;
        res.json(out);
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
