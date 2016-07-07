const mongoose = require('mongoose');
const _ = require('lodash');
const Promise = require('bluebird');
const publication = require('../../dgfr/publication');
const through2 = require('through2');
const sidekick = require('../../helpers/sidekick');

const Dataset = mongoose.model('Dataset');
const Record = mongoose.model('ConsolidatedRecord');

/* Helpers */

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

function fetchPublicationInfos(organizationIdFilter) {
    const query = {
        'publication.status': { $exists: true }
    };
    if (organizationIdFilter) {
        query['publication.organization'] = organizationIdFilter;
    }
    return Dataset.find(query).exec();
}

function groupDatasetsIdsByPublicationStatus(organization) {
    const fetchMatchingQuery = buildMatchingQuery(organization);

    return Promise.join(
        fetchPublicationInfos(organization && organization._id),
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

function computePublicationMetrics(organization) {
    return groupDatasetsIdsByPublicationStatus(organization)
        .then(groupedDatasets => ({
            notPublishedYet: groupedDatasets.notPublishedYet.length,
            notMatchingAnymore: groupedDatasets.notMatchingAnymore.length,
            published: _.mapValues(groupedDatasets.published, item => item.length),
            matching: groupedDatasets.matching.length
        }));
}

function fetchExistingRecordIdsByIds(recordIds) {
    return Record
        .find({ recordId: { $in: recordIds } })
        .select('recordId')
        .exec()
        .map(record => record.recordId);
}

function fetchBrokenDatasetIds(organizationId) {
    return fetchPublicationInfos(organizationId)
        .then(publicationInfos => {
            const publishedRecordIds = _.pluck(publicationInfos, '_id');
            return fetchExistingRecordIdsByIds(publishedRecordIds)
                .then(existingRecordIds => _.difference(publishedRecordIds, existingRecordIds));
        });
}

function fetchRecordsNotPublishedYet(organization) {
    const query = {
        facets: { $all: [
            { $elemMatch: { name: 'availability', value: 'yes'} },
            { $elemMatch: { name: 'opendata', value: 'yes'} },
            { $elemMatch: { name: 'dgvPublication', value: 'no'} }
        ] }
    };
    if (organization) {
        query.organizations = { $in: _.pluck(organization.producers, '_id') };
        query.catalogs = organization.sourceCatalog;
    }
    return Record
        .find(query)
        .select('recordId metadata.title')
        .exec()
        .map(record => ({ _id: record.recordId, title: record.metadata.title }));
}

function fetchPublishedRecordsNotInList(list, organization) {
    if (!organization) throw new Error('organization is required');
    if (!list) throw new Error('list is required');

    const query = {
        recordId: { $nin: list },
        $or: [
            {
                facets: { $elemMatch: { name: 'dgvPublication', value: 'public' } }
            },
            {
                facets: { $elemMatch: { name: 'dgvPublication', value: 'private' } }
            }
        ],
        organizations: { $in: _.pluck(organization.producers, '_id') }
    };

    return Record
        .find(query)
        .select('metadata.title')
        .exec()
        .map(record => ({ _id: record._id, title: record.metadata.title }));
}

function fetchRecordsPublishedByOthers(organization) {
    if (!organization) throw new Error('organization is required');

    return fetchPublicationInfos(organization._id)
        .then(publicationInfos => _.pluck(publicationInfos, '_id'))
        .then(publishedRecordIds => fetchPublishedRecordsNotInList(publishedRecordIds, organization));
}

function fetchRecordsInList(list) {
    if (!list) throw new Error('list is required');

    return Record
        .find({ recordId: { $in: list } })
        .select('metadata.title')
        .exec()
        .map(record => ({ _id: record._id, title: record.metadata.title }));
}

/* Actions */

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

exports.groupedIds = function (req, res, next) {
    groupDatasetsIdsByPublicationStatus(req.organization)
        .then(groupedIds => res.send(groupedIds))
        .catch(next);
};

exports.metrics = function (req, res, next) {
    computePublicationMetrics(req.organization)
        .then(metrics => res.send(metrics))
        .catch(next);
};

exports.notPublishedYet = function (req, res, next) {
    fetchRecordsNotPublishedYet(req.organization)
        .then(records => res.send(records))
        .catch(next);
};

exports.published = function (req, res, next) {
    fetchPublicationInfos(req.organization && req.organization._id)
        .then(publicationInfos => _.pluck(publicationInfos, '_id'))
        .then(publishedRecordIds => fetchRecordsInList(publishedRecordIds))
        .then(publishedRecords => res.send(publishedRecords))
        .catch(next);
};

exports.publishedByOthers = function (req, res, next) {
    fetchRecordsPublishedByOthers(req.organization)
        .then(records => res.send(records))
        .catch(next);
};

exports.broken = function (req, res, next) {
    fetchBrokenDatasetIds(req.organization && req.organization._id)
        .then(brokenDatasetIds => res.send(brokenDatasetIds))
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
    let count = 0;
    let query;
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
            sidekick('dgv:publish', {
              recordId: dataset._id,
              updateOnly: true
            })
            .then(() => {
                count++;
                done();
            })
            .catch(err => done(err));
        }))
        .on('finish', function () {
            res.send({ status: 'ok', count });
        });
};
