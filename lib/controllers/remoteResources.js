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
	res.send(req.remoteResource);
};

exports.check = function (req, res, next) {
	RemoteResource.triggerCheck(req.remoteResource, function (err) {
		if (err) return next(err);
		res.sendStatus(200);
	});
};
