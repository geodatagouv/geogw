/*
** Module dependencies
*/
var mongoose = require('mongoose');
var _ = require('lodash');
var Record = mongoose.model('Record');

exports.search = function(req, res, next) {
    var query = Record.find().where('metadata.type').in(['dataset', 'series']);
    if (req.query.q && req.query.q.length) {
        query
            .where({ $text: { $search: req.query.q, $language: 'french' }})
            .select({ score: { $meta: "textScore" } })
            .sort({ score: { $meta: "textScore" } });
    }
    if (req.query.opendata === "true") {
        query
            .where('metadata.keywords')
            .in(['donnée ouverte', 'données ouvertes', 'opendata']);
    }
    if (req.service) query.where('parentCatalog', req.service.id);
    query
        .limit(20)
        .exec(function(err, datasets) {
            if (err) return next(err);
            res.json(datasets);
        });
};