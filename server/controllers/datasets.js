/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Record = mongoose.model('Record');
var async = require('async');

exports.search = function(req, res, next) {
    function buildQuery() {
        var query = Record.find().where('metadata.type').in(['dataset', 'series']);
        if (req.query.q && req.query.q.length) {
            query
                .where({ $text: { $search: req.query.q, $language: 'french' }})
                .select({ score: { $meta: 'textScore' } })
                .sort({ score: { $meta: 'textScore' } });
        }
        if (req.query.opendata === 'true') {
            query
                .where('metadata.keywords')
                .in(['donnée ouverte', 'données ouvertes', 'opendata']);
        }
        if (req.service) query.where('parentCatalog', req.service.id);
        return query;
    }

    async.parallel({
        results: function(callback) {
            buildQuery().limit(20).exec(callback);
        },
        count: function(callback) {
            buildQuery().count().exec(callback);
        }
    }, function(err, out) {
        if (err) return next(err);
        res.json(out);
    });
};