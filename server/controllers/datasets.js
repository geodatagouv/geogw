/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Record = mongoose.model('Record');
var async = require('async');
var _ = require('lodash');

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
            if (!dataset) return res.send(404);
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
    var q, limit, offset, opendata;
    if (req.query.q && _.isString(req.query.q) && req.query.q.length) q = req.query.q;
    limit = parseInt(req.query.limit);
    limit = _.isNumber(limit) && limit > 0 && limit <= 100 ? Math.floor(limit) : 20;
    offset = parseInt(req.query.offset);
    offset = _.isNumber(offset) && offset > 0 ? Math.floor(offset) : 0;
    opendata = req.query.opendata === 'true';

    function buildQuery() {
        var query = Record.find().where('metadata.type').in(['dataset', 'series']);
        if (q) query.where({ $text: { $search: q, $language: 'french' }});
        if (opendata) query.where('metadata.keywords').in(OPENDATA_KEYWORDS);
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