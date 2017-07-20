'use strict';

const mongoose = require('mongoose');
const Producer = mongoose.model('Producer');
const Record = mongoose.model('ConsolidatedRecord');

exports.list = function (req, res, next) {
    Producer
        .find()
        .lean()
        .exec(function (err, producers) {
            if (err) return next(err);
            res.send(producers);
        });
};

exports.fetch = function (req, res, next, id) {
    Producer.findById(id, function (err, producer) {
        if (err) return next(err);
        if (!producer) return res.sendStatus(404);
        req.producer = producer;
        next();
    });
};

exports.associate = function (req, res, next) {
    Producer.create({ _id: req.body._id, associatedTo: req.organization._id }, function (err, producer) {
        if (err) return next(err);
        res.send(producer);
    });
};

exports.dissociate = function (req, res, next) {
    if (!req.producer.associatedTo.equals(req.organization._id)) return res.sendStatus(404);
    Producer.findByIdAndRemove(req.producer._id, function (err) {
        if (err) return next(err);
        res.status(204).end();
    });
};

const facetEligibilityCondition = { $all: [
    { $elemMatch: { name: 'availability', value: 'yes' } },
    { $elemMatch: { name: 'opendata', value: 'yes' } }
] };

exports.listByOrganization = function (req, res, next) {
  Record
    .distinct('organizations', {
      facets: facetEligibilityCondition,
      catalogs: { $in: req.organization.sourceCatalogs }
    })
    .exec()
    .then(eligibleProducersNames => {
      return Producer.find({ _id: { $in: eligibleProducersNames } }).lean().exec()
        .then(associatedProducers => {
          const associatedProducersNames = associatedProducers.map(ap => ap._id);
          const producers = associatedProducers;
          eligibleProducersNames.forEach(eligibleProducerName => {
            if (!associatedProducersNames.includes(eligibleProducerName)) {
              producers.push({ _id: eligibleProducerName });
            }
          });
          return producers;
        });
    })
    .then(producers => res.send(producers))
    .catch(next);
};
