var mongoose = require('mongoose');
var through2 = require('through2');
var async = require('async');
// var _ = require('lodash');

// var dgv = require('../dgv');
var q = require('../../kue').jobs;

var Dataset = mongoose.model('Dataset');

exports.list = function (req, res, next) {
    Dataset
        .find({ $or: [
            { 'publication.organization': req.organization._id },
            { matchingFor: req.organization._id }
        ]})
        .populate('publication.organization', 'name')
        .exec(function (err, datasetsFound) {
            if (err) return next(err);
            res.send(datasetsFound);
        });
};

exports.fetch = function (req, res, next, id) {
    Dataset.findById(id, function (err, datasetFound) {
        if (err) return next(err);
        if (!datasetFound) return res.sendStatus(404);
        req.dataset = datasetFound;
        next();
    });
};

exports.statistics = function (req, res, next) {
    async.parallel({
        published: function (cb) {
            Dataset.count({ 'publication.status': 'public' }, cb);
        // },
        // organizations: function (cb) {
        //     Dataset.distinct('publication.organization', { 'publication.status': 'public' }, function (err, organizations) {
        //         if (err) return cb(err);
        //         async.map(organizations, function (organizationId, iterDone) {
        //             dgv.getOrganization(organizationId, function (err, result) {
        //                 if (err) return iterDone(err);
        //                 var organization = _.pick(result, 'id', 'name', 'page', 'logo');
        //                 organization.featured = organization.id !== '54a13044c751df096c04805a';
        //                 iterDone(null, organization);
        //             });
        //         }, cb);
        //     });
        }
    }, function (err, result) {
        if (err) return next(err);
        res.send(result);
    });
};

exports.publish = function (req, res, next) {
    var dataset = req.dataset;

    if (req.body.status) dataset.set('publication.status', req.body.status);
    if (req.body.sourceCatalog) dataset.set('publication.sourceCatalog', req.body.sourceCatalog);

    function onSuccess(err, updatedDataset) {
        if (err) return next(err);
        res.send(updatedDataset.toObject().publication);
    }

    if (dataset.publication._id) {
        dataset.synchronize(onSuccess);
    } else {
        if (!req.body.organization || !req.body.sourceCatalog) return res.sendStatus(400);

        dataset.set('publication.organization', req.body.organization);
        dataset.publish(onSuccess);
    }
};

exports.unpublish = function (req, res, next) {
    req.dataset.unpublish(function (err) {
        if (err) return next(err);
        res.sendStatus(204);
    });
};

exports.publishAll = function (req, res) {
    if (!req.organization.sourceCatalog) return res.sendStatus(400);

    var count = 0;
    Dataset
        .find({
            matchingFor: req.organization._id,
            'publication.organization': { $exists: false },
            'publication._id': { $exists: false },
            'publication.status': { $exists: false }
        })
        .lean()
        .stream()
        .pipe(through2.obj(function (dataset, enc, done) {
            q
                .create('dgv:publish', {
                    organizationId: req.organization._id,
                    datasetId: dataset._id,
                    sourceCatalog: req.organization.sourceCatalog,
                    publicationStatus: 'public'
                })
                .save(function (err) {
                    if (err) return done(err);
                    count++;
                    done(null, null);
                });
        }))
        .on('end', function () {
            res.send({ status: 'ok', count: count });
        });
};

exports.unpublishAll = function (req, res) {
    var count = 0;
    Dataset
        .find({ 'publication.organization': req.organization._id })
        .stream()
        .pipe(through2.obj(function (dataset, enc, done) {
            dataset.unpublish(function (err) {
                if (err) return done(err);
                count++;
                done(null, null);
            });
        }))
        .on('end', function () {
            res.send({ status: 'ok', count: count });
        });
};


exports.syncAll = function (req, res) {
    var count = 0;
    Dataset
        .find({ 'publication.organization': req.organization._id })
        .lean()
        .stream()
        .pipe(through2.obj(function (dataset, enc, done) {
            q
                .create('dgv:publish', {
                    organizationId: req.organization._id,
                    datasetId: dataset._id
                })
                .save(function (err) {
                    if (err) return done(err);
                    count++;
                    done(null, null);
                });
        }))
        .on('end', function () {
            res.send({ status: 'ok', count: count });
        });
};
