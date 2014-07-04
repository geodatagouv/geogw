/*
** Module dependencies
*/
var mongoose = require('mongoose');
var _ = require('lodash');
var Service = mongoose.model('Service');
var async = require('async');

/*
** Middlewares
*/
exports.service = function(req, res, next, id) {
    Service
        .findById(id)
        .populate('addedBy', 'fullName')
        .populate('lastSync')
        .populate('lastSuccessfulSync')
        .exec(function(err, service) {
            if (err) return next(err);
            if (!service) return res.send(404);
            req.service = service;
            next();
        });
};

/*
** Actions
*/
exports.list = function(req, res, next) {
    Service
        .find()
        .populate('addedBy', 'fullName')
        .populate('lastSync')
        .populate('lastSuccessfulSync')
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
    req.service.createSync(function(err) {
        if (err) return next(err);
        res.send(req.service);
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
                service.createSync(cb);
            }, function(err) {
                if (err) return next(err);
                res.send({ status: 'ok', services: services.length });
            });
        });
};
