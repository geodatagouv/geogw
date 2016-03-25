/*
** Module dependencies
*/
var mongoose = require('mongoose');
var _s = require('underscore.string');

var FeatureType = mongoose.model('FeatureType');


/* Middlewares */
exports.featureType = function (req, res, next, id) {
    FeatureType
        .findOne({ service: req.params.serviceId, name: id })
        .exec(function (err, featureType) {
            if (err) return next(err);
            if (!featureType) return res.status(404).end();
            req.featureType = featureType;
            next();
        });
};

/* Actions */
exports.list = function (req, res, next) {
    FeatureType
    .find({ service: req.service._id })
    .select({ service: 0 })
    .exec(function (err, featureTypes) {
        if (err) return next(err);
        res.send(featureTypes);
    });
};

exports.show = function (req, res) {
    res.send(req.featureType);
};

exports.prepateFeatureTypeDownload = function (req, res, next) {
    if (req.service.protocol !== 'wfs') return next(new Error('Protocol not supported'));
    if (!req.featureType.available) {
        return res.status(404).send({
            code: 404,
            message: 'FeatureType `' + req.params.typeName + '` no more available on this service'
        });
    }
    req.ogr2ogr = {};
    req.ogr2ogr.layerName = _s.strRight(req.featureType.name, ':');
    req.ogr2ogr.src = 'WFS:' + req.service.location + (req.service.location.indexOf('?') >= 0 ? '&' : '?');
    next();
};
