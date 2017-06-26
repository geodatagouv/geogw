const mongoose = require('mongoose');
const { clone } = require('lodash');
const search = require('../helpers/search');
const proxyImg = require('../helpers/proxyImg');

const ConsolidatedRecord = mongoose.model('ConsolidatedRecord');
const RelatedResource = mongoose.model('RelatedResource');
const RecordRevision = mongoose.model('RecordRevision');

/*
** Middlewares
*/
exports.record = function(req, res, next, id) {
    ConsolidatedRecord
        .findOne({ recordId: new RegExp('^' + id) })
        .exec(function(err, record) {
            if (err) return next(err);
            if (!record) return res.sendStatus(404);
            req.record = record;
            next();
        });
};

exports.recordRevision = (req, res, next, id) => {
    RecordRevision
        .findOne({ recordId: req.record.recordId, recordHash: id })
        .exec((err, recordRevision) => {
            if (err) return next(err);
            if (!recordRevision) return res.sendStatus(404);
            req.recordRevision = recordRevision;
            next();
        });
};

/*
** Actions
*/
exports.show = function(req, res) {
    res.send(req.record);
};

exports.showBestRevision = (req, res, next) => {
    RecordRevision
        .findOne({ recordId: req.record.recordId, recordHash: req.record.recordHash })
        .exec((err, recordRevision) => {
            if (err) return next(err);
            if (!recordRevision) return res.sendStatus(404);
            res.send(recordRevision);
        });
};

exports.showRevision = function(req, res) {
    res.send(req.recordRevision);
};

exports.search = function(req, res, next) {
    var query = clone(req.query);
    var catalogName = req.service ? req.service.name : undefined;

    search(query, catalogName)
      .then(result => res.send(result))
      .catch(next);
};

exports.showRelatedResources = function (req, res, next) {
    RelatedResource
        .find({ record: req.record.recordId })
        .lean()
        .exec(function (err, foundRelatedResources) {
            if (err) return next(err);
            res.send(foundRelatedResources);
        });
};

exports.consolidate = function (req, res, next) {
  ConsolidatedRecord.triggerUpdated(req.record.recordId, 'manual')
    .then(() => res.send({ status: 'ok' }))
    .catch(next);
};

exports.thumbnail = function (req, res) {
  const thumbnail = req.record.metadata.thumbnails.find(th => th.originalUrlHash === req.params.originalUrlHash);
  if (!thumbnail) return res.sendStatus(404);
  proxyImg(thumbnail.originalUrl, req, res);
};
