const express = require('express');
const { publish, unpublish, globalMetrics, metrics, published, notPublishedYet, publishedByOthers, synchronizeAll } = require('../controllers/datasets');
const { ensureLoggedIn, isEditorOf, organizationIsSet } = require('../middlewares');

function isPublished(req, res, next) {
  if (req.publicationInfo) return next();
  res.sendStatus(400);
}

function isNotPublished(req, res, next) {
  if (!req.publicationInfo) return next();
  res.sendStatus(400);
}

function validatePublicationParams(req, res, next) {
  if (!req.body.organization) return res.sendStatus(400);
  next();
}

module.exports = function () {
  const router = express.Router();

  router.route('/api/datasets/:datasetId/publication')
      .all(ensureLoggedIn)
      .put(isNotPublished, validatePublicationParams, isEditorOf(req => req.body.organization), publish)
      .delete(isPublished, isEditorOf(req => req.publicationInfo.publication.organization.toString()), unpublish);

  router.get('/api/datasets/metrics', globalMetrics);
  router.get('/api/organizations/:organizationId/datasets/metrics', organizationIsSet, metrics);

  router.get('/api/organizations/:organizationId/datasets/not-published-yet', organizationIsSet, notPublishedYet);
  router.get('/api/organizations/:organizationId/datasets/published', organizationIsSet, published);
  router.get('/api/organizations/:organizationId/datasets/published-by-others', organizationIsSet, publishedByOthers);

  router.post('/api/datasets/synchronize-all', synchronizeAll);

  return router;
};
