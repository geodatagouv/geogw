var mongoose = require('mongoose');
var _ = require('lodash');
var async = require('async');

var Organization = mongoose.model('Organization');
var Producer = mongoose.model('Producer');

exports.fetch = function (req, res, next, id) {
    async.parallel({
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
    var organization = req.organization.toObject();
    organization.producers = req.organization.producers;
    res.send(organization);
};

exports.create = function (req, res, next) {
    var now = new Date();

    req.organization = new Organization(_.pick(req.body, 'sourceCatalog'));
    req.organization
        .set('_id', req.body._id)
        .set('_updated', now)
        .set('_created', now)
        .set('name', _.find(req.user.toObject().organizations, { _id: req.body._id }).name)
        .set('status', 'disabled')
        .save(next);
};

exports.update = function (req, res, next) {
    req.organization
        .set(_.pick(req.body, 'sourceCatalog', 'sourceOrganizations'))
        .set('_updated', new Date())
        .save(next);
};

exports.list = function (req, res, next) {
    Organization.find().lean().exec(function (err, organizations) {
        if (err) return next(err);
        res.send(organizations);
    });
};
