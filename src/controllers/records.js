/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Record = mongoose.model('Record');
var _ = require('lodash');

var search = require('../helpers/search');
var jobs = require('../kue').jobs;

/*
** Middlewares
*/
exports.record = function(req, res, next, id) {
    var query = { hashedId: new RegExp('^' + id) };
    if (req.params.serviceId) {
        query.parentCatalog = req.params.serviceId;
    }
    Record
        .findOne(query)
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

exports.findByIdentifier = function(req, res, next) {
    Record
        .find({ identifier: req.params.identifier })
        .populate('parentCatalog')
        .exec(function(err, records) {
            if (err) return next(err);
            res.send(records);
        });
};

exports.search = function(req, res, next) {
    var query = _.clone(req.query);
    query.catalog = req.service._id;

    search(query, function (err, result) {
        if (err) return next(err);
        res.send(result);
    });
};

exports.forceReprocess = function (req, res, next) {
    jobs
        .create('process-record', {
            hashedId: req.record.hashedId,
            catalogId: req.record.parentCatalog
        })
        .removeOnComplete(true)
        .attempts(5)
        .save(function (err) {
            if (err) return next(err);
            res.status(200).end();
        });
};
