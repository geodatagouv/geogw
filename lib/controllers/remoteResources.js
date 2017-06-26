/*
** Module dependencies
*/
var mongoose = require('mongoose');

var RemoteResource = mongoose.model('RemoteResource');
var ConsolidatedRecord = mongoose.model('ConsolidatedRecord');

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

exports.records = function (req, res, next) {
    ConsolidatedRecord
        .find({ 'dataset.distributions.hashedLocation': req.remoteResource.hashedLocation })
        .select('recordId metadata.title catalogs')
        .lean()
        .exec(function (err, recordsFound) {
            if (err) return next(err);
            res.send(recordsFound);
        });
};
