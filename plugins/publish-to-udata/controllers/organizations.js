const mongoose = require('mongoose');
const { pick } = require('lodash');
const { parallel } = require('async');

const Organization = mongoose.model('Organization');
const Producer = mongoose.model('Producer');

const EDITABLE_FIELDS = ['sourceCatalog', 'publishAll'];

exports.fetch = function (req, res, next, id) {
    parallel({
        organization: function (done) {
            Organization.findById(id, done);
        },
        producers: function (done) {
            Producer
                .find({ associatedTo: id })
                .select('-associatedTo')
                .exec(done);
        }
    }, function (err, result) {
        if (err) return next(err);
        if (!result.organization) return res.sendStatus(404);
        req.organization = result.organization;
        req.organization.producers = result.producers;
        next();
    });
};

exports.show = function (req, res) {
    const organization = req.organization.toObject();
    organization.producers = req.organization.producers;
    res.send(organization);
};

exports.create = function (req, res, next) {
    req.organization = new Organization(pick(req.body, ...EDITABLE_FIELDS));
    req.organization
        .set('_id', req.body._id)
        .save()
        .then(() => req.organization.enable(req.user.accessToken))
        .then(() => res.send(req.organization))
        .catch(next);
};

exports.update = function (req, res, next) {
    req.organization
        .set(pick(req.body, ...EDITABLE_FIELDS))
        .save()
        .then(() => req.organization.enable(req.user.accessToken))
        .then(() => res.send(req.organization))
        .catch(next);
};

exports.list = function (req, res, next) {
    Organization.find().lean().exec(function (err, organizations) {
        if (err) return next(err);
        res.send(organizations);
    });
};
