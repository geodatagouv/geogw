/*
** Module dependencies
*/
var mongoose = require('mongoose');

var RemoteResource = mongoose.model('RemoteResource');

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
