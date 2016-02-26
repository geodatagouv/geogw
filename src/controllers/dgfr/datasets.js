const mongoose = require('mongoose');
const through2 = require('through2');
const _ = require('lodash');
const Promise = require('bluebird');

const q = require('../../kue').jobs;

const Dataset = mongoose.model('Dataset');
const Record = mongoose.model('ConsolidatedRecord');

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

exports.publish = function (req, res, next) {
    var dataset = req.dataset;

    if (req.body.status) dataset.set('publication.status', req.body.status);

    function onSuccess(err, updatedDataset) {
        if (err) return next(err);
        res.send(updatedDataset.toObject().publication);
    }

    if (dataset.publication._id) {
        dataset.synchronize(onSuccess);
    } else {
        if (!req.body.organization) return res.sendStatus(400);

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

function computePublicationMetrics(organization) {
    const fetchPublishedQuery = {
        'publication.status': { $exists: true }
    };

    const fetchMatchingQuery = {
        facets: { $all: [
            { $elemMatch: { name: 'availability', value: 'yes'} },
            { $elemMatch: { name: 'opendata', value: 'yes'} }
        ] }
    };

    if (organization) {
        fetchPublishedQuery['publication.organization'] = organization._id;
        fetchMatchingQuery.organizations = { $in: _.pluck(organization.producers, '_id') };
        fetchMatchingQuery.catalogs = organization.sourceCatalog;
    }

    return Promise.join(
        Dataset.find(fetchPublishedQuery, 'publication.status').exec(),
        Record.find(fetchMatchingQuery, '-_id recordId').exec(),
        // handler
        function (publishedDatasets, matchingDatasets) {
            const published = _.pluck(publishedDatasets, '_id');
            const publicationStatusesCount = _.chain(publishedDatasets)
                .groupBy(item => item.publication.status)
                .mapValues(publicationStatus => publicationStatus.length)
                .value();
            const matching = _.pluck(matchingDatasets, 'recordId');
            const notMatchingAnymore = _.difference(published, matching);
            const notPublishedYet = _.difference(matching, published);
            return {
                notPublishedYet: notPublishedYet.length,
                notMatchingAnymore: notMatchingAnymore.length,
                published: publicationStatusesCount,
                matching: matching.length
            };
        }
    );
}

exports.metrics = function (req, res, next) {
    computePublicationMetrics(req.organization)
        .then(metrics => res.send(metrics))
        .catch(next);
};

exports.publishAll = function (req, res) {
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
                if (err)
                    console.error(err);
                else
                    count++;
                done();
            });
        }))
        .on('end', function () {
            res.send({ status: 'ok', count: count });
        });
};


exports.syncAll = function (req, res) {
    var count = 0;
    var query;
    if (req.organization && req.organization._id) {
        query = Dataset.where('publication.organization', req.organization._id);
    } else if (req.query.confirm === 'yes') {
        query = Dataset.where('publication').exists();
        if (req.query.before) query.where('publication.updatedAt').lt(new Date(req.query.before));
    } else {
        return res.sendStatus(400);
    }
    query
        .lean()
        .stream()
        .pipe(through2.obj(function (dataset, enc, done) {
            if (!dataset.publication || !dataset.publication.organization) return done();
            q
                .create('dgv:publish', {
                    organizationId: dataset.publication.organization,
                    datasetId: dataset._id
                })
                .save(function (err) {
                    if (err) return done(err);
                    count++;
                    done(null, null);
                });
        }))
        .on('finish', function () {
            res.send({ status: 'ok', count: count });
        });
};
