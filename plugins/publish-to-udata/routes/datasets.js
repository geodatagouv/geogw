const { fetch, list, publish, unpublish, metrics, groupedIds, published, notPublishedYet, publishedByOthers } = require('../controllers/datasets');
const { ensureLoggedIn, isEditorOf } = require('../middlewares');

function isPublished(req, res, next) {
  if (req.publicationInfo) return next();
  res.sendStatus(400);
}

function isNotPublished(req, res, next) {
  if (!req.publicationInfo) return next();
  res.sendStatus(400);
}

module.exports = function (router) {

  router.param('datasetId', fetch);

  router.route('/api/organizations/:organizationId/datasets')
      .get(list);

  router.route('/api/datasets/:datasetId/publication')
      .all(ensureLoggedIn)
      .put(isNotPublished, isEditorOf(req => req.body.organization), publish)
      .delete(isPublished, isEditorOf(req => req.publicationInfo.publication.organization.toString()), unpublish);

  router.get('/api/datasets/metrics', metrics);
  router.get('/api/organizations/:organizationId/datasets/metrics', metrics);


  router.get('/api/organizations/:organizationId/datasets/grouped-ids', groupedIds);

  router.get('/api/organizations/:organizationId/datasets/not-published-yet', notPublishedYet);
  router.get('/api/organizations/:organizationId/datasets/published', published);
  router.get('/api/organizations/:organizationId/datasets/published-by-others', publishedByOthers);


};
