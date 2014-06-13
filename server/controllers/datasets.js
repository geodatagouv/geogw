/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Record = mongoose.model('Record');
var async = require('async');
var _ = require('lodash');

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
        if (opendata) query.where('metadata.keywords').in(['donnée ouverte', 'données ouvertes', 'opendata']);
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