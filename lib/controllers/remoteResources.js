/*
** Module dependencies
*/
var mongoose = require('mongoose');

var RemoteResource = mongoose.model('RemoteResource');
var ConsolidatedRecord = mongoose.model('ConsolidatedRecord');

const { formatOne } = require('../formatters/remoteResources');
const { formatMany } = require('../formatters/records');

/*
** Middlewares
*/
exports.remoteResource = function(req, res, next, id) {
    RemoteResource
    .findOne({ hashedLocation: id })
    .lean()
    .exec(function(err, remoteResource) {
        if (err) return next(err);
        if (!remoteResource) return res.status(404).end();
        req.remoteResource = remoteResource;
        next();
    });
};

/*
** Actions
*/
exports.show = function (req, res) {
    res.send(formatOne(req.remoteResource));
};

exports.check = function (req, res, next) {
    RemoteResource.triggerCheck(req.remoteResource)
        .then(job => {
            res.send({
                status: 'ok',
                message: 'Created job ' + job.id
            });
        })
        .catch(next);
};

exports.records = function (req, res, next) {
    ConsolidatedRecord
        .find({ 'dataset.distributions.hashedLocation': req.remoteResource.hashedLocation })
        .select('recordId metadata.title catalogs')
        .lean()
        .exec(function (err, recordsFound) {
            if (err) return next(err);
            res.send(formatMany(recordsFound));
        });
};
