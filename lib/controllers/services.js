const mongoose = require('mongoose');
const { pick } = require('lodash');
const Promise = require('bluebird');

const Service = mongoose.model('Service');
const ServiceSync = mongoose.model('ServiceSync');


exports.service = function(req, res, next, id) {
    Service
        .findById(id)
        .exec(function(err, service) {
            if (err) return next(err);
            if (!service) return res.status(404).end();
            req.service = service;
            next();
        });
};

exports.sync = function(req, res, next, id) {
    ServiceSync
        .findById(id)
        .where('service').equals(req.service.id)
        .exec(function(err, serviceSync) {
            if (err) return next(err);
            if (!serviceSync) return res.sendStatus(404);
            req.serviceSync = serviceSync;
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
        .exec(function(err, services) {
            if (err) return next(err);
            res.json(services);
        });
};

exports.create = function(req, res, next) {
    var service = new Service();
    service.set(pick(req.body, 'name', 'location', 'protocol'));
    service.addedBy = req.user;

    service.save(function(err) {
        if (err) return next(err);
        res.json(service);
    });
};

exports.show = function(req, res) {
    res.send(req.service);
};


exports.handleSync = function(req, res, next) {
    req.service.doSync(0)
      .then(() => res.send(req.service))
      .catch(next);
};

exports.listSyncs = function(req, res, next) {
    ServiceSync
        .find()
        .where('service').equals(req.service.id)
        .where('status').ne('queued')
        .sort('-finished')
        .limit(10)
        .exec(function(err, serviceSyncs) {
            if (err) return next(err);
            res.send(serviceSyncs);
        });
};

exports.showSync = function (req, res) {
    res.send(req.serviceSync);
};

exports.syncAllByProtocol = function(req, res, next) {
    Service
        .find()
        .where('protocol').equals(req.params.protocol)
        .exec()
        .then(services => {
          return Promise.each(services, service => service.doSync(0))
            .then(() => res.send({ status: 'ok', services: services.length }));
        })
        .catch(next);
};
