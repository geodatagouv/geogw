/*
** Module dependencies
*/
var mongoose = require('mongoose');
var ConsolidatedRecord = mongoose.model('ConsolidatedRecord');
var _ = require('lodash');

var search = require('../helpers/search');

/*
** Middlewares
*/
exports.record = function(req, res, next, id) {
    ConsolidatedRecord
        .findOne({ recordId: new RegExp('^' + id) })
        .exec(function(err, record) {
            if (err) return next(err);
            if (!record) return res.sendStatus(404);
            req.record = record;
            next();
        });
};

/*
** Actions
*/
exports.show = function(req, res) {
    res.send(req.record);
};

exports.search = function(req, res, next) {
    var query = _.clone(req.query);
    var catalogName = req.service ? req.service.name : undefined;

    search(query, catalogName, function (err, result) {
        if (err) return next(err);
        res.send(result);
    });
};

