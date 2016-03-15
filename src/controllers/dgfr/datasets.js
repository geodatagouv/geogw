const mongoose = require('mongoose');
const through2 = require('through2');
const _ = require('lodash');
const Promise = require('bluebird');
const publication = require('../../dgfr/publication');

const q = require('../../kue').jobs;

const Dataset = mongoose.model('Dataset');
const Record = mongoose.model('ConsolidatedRecord');

function buildMatchingQuery(organization) {
    const fetchMatchingQuery = {
        $or: [
            {
                facets: { $all: [
                    { $elemMatch: { name: 'availability', value: 'yes'} },
                    { $elemMatch: { name: 'opendata', value: 'yes'} }
                ] }
            },
            {
                facets: { $elemMatch: { name: 'dgvPublication', value: 'public' } }
            },
            {
                facets: { $elemMatch: { name: 'dgvPublication', value: 'private' } }
            }
        ]
    };
    if (organization) {
        fetchMatchingQuery.organizations = { $in: _.pluck(organization.producers, '_id') };
        fetchMatchingQuery.catalogs = organization.sourceCatalog;
    }
    return fetchMatchingQuery;
}

exports.list = function (req, res, next) {
    const fetchMatchingQuery = buildMatchingQuery(req.organization);
    Record.find(fetchMatchingQuery).select('recordId metadata.title publications')
        .exec(function (err, datasetsFound) {
            if (err) return next(err);
            res.send(datasetsFound.map(dataset => {
                return {
                    title: dataset.metadata.title,
                    _id: dataset.recordId,
                    publication: dataset.publications.length ? {
                        organization: dataset.publications[0].owner,
                        _id: dataset.publications[0].id,
                        status: dataset.publications[0].status
                    } : {}
                };
            }));
        });
};

exports.fetch = function (req, res, next, id) {
    Promise.join(
        Record.findOne({ recordId: id }).exec(),
        Dataset.findById(id).exec(),

        function (record, publicationInfo) {
            if (!record) return res.sendStatus(404);
            req.dataset = record;
            if (publicationInfo && publicationInfo.publication && publicationInfo.publication.organization) {
                req.publicationInfo = publicationInfo;
            }
            next();
        }
    )
    .catch(next);
};

exports.publish = function (req, res, next) {
    if (!req.body.organization) return res.sendStatus(400);

    publication.publishDataset(req.dataset, {
        owner: req.body.organization,
        publicationStatus: req.body.status,
        id: req.publicationInfo ? req.publicationInfo.publication._id : null
    })
    .then(result => res.send(result))
    .catch(next);
};

exports.unpublish = function (req, res, next) {
    publication.unpublishDataset(req.dataset, {
        owner: req.publicationInfo.publication.organization,
        id: req.publicationInfo ? req.publicationInfo.publication._id : null
    })
    .then(() => res.send({ status: 'unpublished' }))
    .catch(next);
};

function groupDatasetsIdsByPublicationStatus(organization) {
    const fetchPublishedQuery = {
        'publication.status': { $exists: true }
    };

    const fetchMatchingQuery = buildMatchingQuery(organization);

    if (organization) {
        fetchPublishedQuery['publication.organization'] = organization._id;
    }

    return Promise.join(
        Dataset.find(fetchPublishedQuery, 'publication.status').exec(),
        Record.find(fetchMatchingQuery, '-_id recordId').exec(),
        // handler
        function (publishedDatasets, matchingDatasets) {
            const published = _.pluck(publishedDatasets, '_id');
            const publishedWithStatus = _.chain(publishedDatasets)
                .groupBy(item => item.publication.status)
                .mapValues(item => _.pluck(item, '_id'))
                .value();
            const matching = _.pluck(matchingDatasets, 'recordId');
            const notMatchingAnymore = _.difference(published, matching);
            const notPublishedYet = _.difference(matching, published);
            return {
                notPublishedYet,
                notMatchingAnymore,
                published: publishedWithStatus,
                matching
            };
        }
    );
}

exports.groupedIds = function (req, res, next) {
    groupDatasetsIdsByPublicationStatus(req.organization)
        .then(groupedIds => res.send(groupedIds))
        .catch(next);
};

function computePublicationMetrics(organization) {
    return groupDatasetsIdsByPublicationStatus(organization)
        .then(groupedDatasets => ({
            notPublishedYet: groupedDatasets.notPublishedYet.length,
            notMatchingAnymore: groupedDatasets.notMatchingAnymore.length,
            published: _.mapValues(groupedDatasets.published, item => item.length),
            matching: groupedDatasets.matching.length
        }));
}

exports.metrics = function (req, res, next) {
    computePublicationMetrics(req.organization)
        .then(metrics => res.send(metrics))
        .catch(next);
};

exports.publishAll = function (req, res) {
    res.sendStatus(501);
    // var count = 0;
    // Dataset
    //     .find({
    //         matchingFor: req.organization._id,
    //         'publication.organization': { $exists: false },
    //         'publication._id': { $exists: false },
    //         'publication.status': { $exists: false }
    //     })
    //     .lean()
    //     .stream()
    //     .pipe(through2.obj(function (dataset, enc, done) {
    //         q
    //             .create('dgv:publish', {
    //                 organizationId: req.organization._id,
    //                 datasetId: dataset._id,
    //                 publicationStatus: 'public'
    //             })
    //             .save(function (err) {
    //                 if (err) return done(err);
    //                 count++;
    //                 done(null, null);
    //             });
    //     }))
    //     .on('end', function () {
    //         res.send({ status: 'ok', count: count });
    //     });
};

exports.unpublishAll = function (req, res) {
    res.sendStatus(501);
    // var count = 0;
    // Dataset
    //     .find({ 'publication.organization': req.organization._id })
    //     .stream()
    //     .pipe(through2.obj(function (dataset, enc, done) {
    //         dataset.unpublish(function (err) {
    //             if (err)
    //                 console.error(err);
    //             else
    //                 count++;
    //             done();
    //         });
    //     }))
    //     .on('end', function () {
    //         res.send({ status: 'ok', count: count });
    //     });
};


exports.syncAll = function (req, res) {
    res.sendStatus(501);
    // var count = 0;
    // var query;
    // if (req.organization && req.organization._id) {
    //     query = Dataset.where('publication.organization', req.organization._id);
    // } else if (req.query.confirm === 'yes') {
    //     query = Dataset.where('publication').exists();
    //     if (req.query.before) query.where('publication.updatedAt').lt(new Date(req.query.before));
    // } else {
    //     return res.sendStatus(400);
    // }
    // query
    //     .lean()
    //     .stream()
    //     .pipe(through2.obj(function (dataset, enc, done) {
    //         if (!dataset.publication || !dataset.publication.organization) return done();
    //         q
    //             .create('dgv:publish', {
    //                 organizationId: dataset.publication.organization,
    //                 datasetId: dataset._id
    //             })
    //             .save(function (err) {
    //                 if (err) return done(err);
    //                 count++;
    //                 done(null, null);
    //             });
    //     }))
    //     .on('finish', function () {
    //         res.send({ status: 'ok', count: count });
    //     });
};
