const mongoose = require('mongoose');
const Publication = mongoose.model('Publication');
const { pick } = require('lodash');

/* Params */

exports.publication = function (req, res, next, publicationTarget) {
  const { recordId } = req.params;

  Publication
    .findOne({ recordId, target: publicationTarget })
    .exec()
    .then(publication => req.publication = publication)
    .thenReturn()
    .asCallback(next);
};

/* Actions */

exports.publishOrUpdate = function (req, res, next) {
  const { recordId, publicationTarget } = req.params;
  const { remoteId, remoteUrl } = req.body;

  if (!req.publication) {
    req.publication = new Publication({ recordId, target: publicationTarget });
  }

  req.publication
    .set({ remoteId, remoteUrl })
    .save()
    .then(publication => res.send(publication))
    .catch(next);
};

exports.show = function (req, res) {
  const FIELDS = ['updatedAt', 'createdAt', 'remoteId', 'remoteUrl'];

  if (!req.publication) {
    res.sendStatus(404);
  } else {
    res.send(pick(req.publication, ...FIELDS));
  }
};

exports.list = function (req, res, next) {
  const { recordId } = req.params;
  const FIELDS = ['updatedAt', 'createdAt', 'remoteId', 'remoteUrl', 'target'];

  Publication.find({ recordId })
    .exec()
    .then(publications => res.send(publications.map(p => pick(p, ...FIELDS))))
    .catch(next);
};

exports.listAll = function (req, res, next) {
  Publication.find({ target: req.params.target }).select({ __v: 0, _id: 0, target: 0 }).lean()
    .exec()
    .then(publications => res.send(publications))
    .catch(next);
};

exports.unpublish = function (req, res, next) {
  if (!req.publication) {
    res.sendStatus(404);
  } else {
    req.publication.remove()
      .then(() => res.sendStatus(204))
      .catch(next);
  }
};
