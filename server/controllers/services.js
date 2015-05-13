/*
** Module dependencies
*/
var mongoose = require('mongoose');
var _ = require('lodash');
var Service = mongoose.model('Service');
var ServiceSync = mongoose.model('ServiceSync');
var async = require('async');

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
