const mongoose = require('mongoose');
const { indexBy } = require('lodash');
const Promise = require('bluebird');
const { getRecord } = require('../geogw');

const Dataset = mongoose.model('Dataset');
const Record = mongoose.model('ConsolidatedRecord');

/* Helpers */

function remoteUrl(remoteId) {
  return `${process.env.DATAGOUV_URL}/datasets/${remoteId}/`;
}

function getNotPublishedYetDatasets(organization) {
  return Dataset.distinct('_id').exec()
    .then(publishedIds => {
      return Record
        .find({
          facets: { $all: [
              { $elemMatch: { name: 'availability', value: 'yes' } },
              { $elemMatch: { name: 'opendata', value: 'yes' } }
          ] },
          catalogs: { $in: organization.sourceCatalogs },
          organizations: { $in: organization.producers }
        })
        .select('recordId metadata.title')
        .lean()
        .exec()
        .filter(record => !publishedIds.includes(record.recordId))
        .map(record => ({ _id: record.recordId, title: record.metadata.title }));
    });
}

function getPublishedByOthersDatasets(organization) {
  return Dataset
    .find({ 'publication.organization': { $ne: organization._id } })
    .select('title publication._id')
    .lean()
    .exec()
    .then(datasets => {
      const indexedDatasets = indexBy(datasets, '_id');

      return Record
        .find({
          catalogs: { $in: organization.sourceCatalogs },
          organizations: { $in: organization.producers }
        })
        .select('recordId metadata.title')
        .lean()
        .exec()
        .filter(record => record.recordId in indexedDatasets)
        .map(record => ({
          _id: record.recordId,
          title: indexedDatasets[record.recordId].title || record.metadata.title,
          remoteUrl: remoteUrl(indexedDatasets[record.recordId].publication._id)
        }));
    });
}

function getPublishedDatasets(organization) {
  return Dataset
    .find({ 'publication.organization': organization._id })
    .select('title publication._id')
    .lean()
    .exec()
    .map(dataset => ({ _id: dataset._id, title: dataset.title, remoteUrl: remoteUrl(dataset.publication._id) }));
}

function getMetrics(organization) {
  return Promise.join(
    getPublishedDatasets(organization),
    getPublishedByOthersDatasets(organization),
    getNotPublishedYetDatasets(organization),

    function (published, publishedByOthers, notPublishedYet) {
      return {
        published: published.length,
        publishedByOthers: publishedByOthers.length,
        notPublishedYet: notPublishedYet.length
      };
    }
  );
}

function getGlobalMetrics() {
  return Dataset.count({}).exec()
    .then(publishedCount => ({ published: publishedCount }));
}

/* Actions */

exports.fetch = function (req, res, next, id) {
    Promise.join(
        getRecord(id),
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
    (new Dataset({ _id: req.dataset.recordId }))
      .asyncPublish({ organizationId: req.body.organization })
      .then(() => res.sendStatus(202))
      .catch(next);
};

exports.unpublish = function (req, res, next) {
    req.publicationInfo.asyncUnpublish()
      .then(() => res.sendStatus(202))
      .catch(next);
};

exports.synchronizeAll = function (req, res, next) {
  const unpublishIfRecordNotFound = req.query.unpublishIfRecordNotFound === 'yes'; // Opt-in option
  const removeIfTargetDatasetNotFound = req.query.removeIfTargetDatasetNotFound !== 'no'; // Opt-out option
  Dataset.asyncSynchronizeAll({ unpublishIfRecordNotFound, removeIfTargetDatasetNotFound })
    .then(() => res.sendStatus(202))
    .catch(next);
};

exports.metrics = function (req, res, next) {
    getMetrics(req.organization)
        .then(metrics => res.send(metrics))
        .catch(next);
};

exports.globalMetrics = function (req, res, next) {
    getGlobalMetrics()
        .then(metrics => res.send(metrics))
        .catch(next);
};

exports.notPublishedYet = function (req, res, next) {
  getNotPublishedYetDatasets(req.organization)
    .then(datasets => res.send(datasets))
    .catch(next);
};

exports.published = function (req, res, next) {
  getPublishedDatasets(req.organization)
    .then(datasets => res.send(datasets))
    .catch(next);
};

exports.publishedByOthers = function (req, res, next) {
    getPublishedByOthersDatasets(req.organization)
        .then(datasets => res.send(datasets))
        .catch(next);
};
