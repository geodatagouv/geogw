const mongoose = require('mongoose');
const { pick } = require('lodash');
const Promise = require('bluebird');

const Organization = mongoose.model('Organization');
const Producer = mongoose.model('Producer');

const EDITABLE_FIELDS = ['sourceCatalog', 'publishAll'];

exports.fetch = function (req, res, next, id) {
  Promise.join(
    Organization.findById(id),
    Producer.find({ associatedTo: id }).select('-associatedTo').exec(),

    function (organization, producers) {
      if (!organization) {
        req.organization = new Organization({ _id: id });
      } else {
        req.organization = organization;
        req.organization.producers = producers;
      }
      next();
    }
  ).catch(next);
};

exports.show = function (req, res) {
  if (!req.organization) return res.sendStatus(404);
    const organization = req.organization.toObject();
    organization.producers = req.organization.producers;
    res.send(organization);
};

exports.createOrUpdate = function (req, res, next) {
    req.organization
        .set(pick(req.body, ...EDITABLE_FIELDS))
        .save()
        .then(() => req.organization.enable(req.user.accessToken))
        .then(() => res.send(req.organization))
        .catch(next);
};

exports.list = function (req, res, next) {
    Organization.find().exec(function (err, organizations) {
        if (err) return next(err);
        res.send(organizations);
    });
};
