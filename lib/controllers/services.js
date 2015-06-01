/*
** Module dependencies
*/
var mongoose = require('mongoose');
var _ = require('lodash');
var _s = require('underscore.string');
var async = require('async');
var ogr2ogr = require('ogr2ogr');

var Service = mongoose.model('Service');
var ServiceSync = mongoose.model('ServiceSync');
var FeatureType = mongoose.model('FeatureType');

/*
** Middlewares
*/
exports.service = function(req, res, next, id) {
    Service
        .findById(id)
        .populate('lastSync')
        .populate('lastSuccessfulSync')
        .exec(function(err, service) {
            if (err) return next(err);
            if (!service) return res.status(404).end();
            req.service = service;
            next();
        });
};

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

/*
** Actions
*/
exports.list = function(req, res, next) {
    var query = Service.find();
    if (req.params.protocol) query.where('protocol').equals(req.params.protocol);
    query
        .populate('lastSync', 'status started')
        .populate('lastSuccessfulSync', 'started finished itemsFound')
        .exec(function(err, services) {
            if (err) return next(err);
            res.json(services);
        });
};

exports.create = function(req, res, next) {
    var service = new Service();
    service.set(_.pick(req.body, 'name', 'location', 'protocol'));
    service.addedBy = req.user;

    service.save(function(err) {
        if (err) return next(err);
        res.json(service);
    });
};

exports.show = function(req, res) {
    res.send(req.service);
};


exports.sync = function(req, res, next) {
    req.service.doSync(0, function(err) {
        if (err) return next(err);
        res.send(req.service);
    });
};

exports.listSyncs = function(req, res, next) {
    ServiceSync
        .find()
        .where('service').equals(req.service.id)
        .sort('finished')
        .exec(function(err, serviceSyncs) {
            if (err) return next(err);
            res.send(serviceSyncs);
        });
};

exports.syncAllByProtocol = function(req, res, next) {
    Service
        .find()
        .where('protocol').equals(req.params.protocol)
        .populate('lastSync')
        .exec(function(err, services) {
            if (err) return next(err);
            async.each(services, function(service, cb) {
                service.doSync(0, cb);
            }, function(err) {
                if (err) return next(err);
                res.send({ status: 'ok', services: services.length });
            });
        });
};

exports.downloadFeatureType = function (req, res, next) {
    if (req.service.protocol !== 'wfs') return next(new Error('Protocol not supported'));
    if (!req.featureType.available) {
        return res.status(404).send({
            code: 404,
            message: 'FeatureType `' + req.params.typeName + '` no more available on this service'
        });
    }

    var ogrstream = ogr2ogr('WFS:' + req.service.location)
        .timeout(60000);

    var simplifiedTypeName = _s.strRight(req.featureType.name, ':');
    var options = [simplifiedTypeName];

    // Projection
    if (req.query.projection === 'WGS84') {
        ogrstream.project('EPSG:4326');
    } else if (req.query.projection === 'Lambert93') {
        ogrstream.project('EPSG:2154');
    } else {
        return res.status(400).send({
            code: 400,
            message: 'No valid projection given'
        });
    }

    // Format
    if (req.query.format === 'GeoJSON') {
        res.type('json');
        res.attachment(simplifiedTypeName + '.json');
        options.push('-explodecollections');
    } else if (req.query.format === 'KML') {
        res.type('application/vnd.google-earth.kml+xml');
        res.attachment(simplifiedTypeName + '.kml');
        ogrstream.format('KML');
        options.push('-explodecollections');
    } else if (req.query.format === 'SHP') {
        res.type('application/x-shapefile');
        res.attachment(simplifiedTypeName + '.zip');
        ogrstream.format('ESRI Shapefile');
    } else {
        return res.status(400).send({
            code: 400,
            message: 'No valid format given'
        });
    }

    ogrstream.options(options).stream().pipe(res);
};
