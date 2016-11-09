const publications = require('../controllers/publications');
const { clientHasScope } = require('./middlewares/auth');

function isSameTarget(req, res, next) {
  if (req.params.publicationTarget !== req.apiClient.options.publicationTarget) {
    return res.sendStatus(403);
  }
  next();
}

module.exports = function (app) {

  app.param('publicationTarget', publications.publication);

  app.route('/records/:recordId/publications')
    .get(publications.list);

  app.route('/records/:recordId/publications/:publicationTarget')
    .get(publications.show)
    .put(clientHasScope('publications'), isSameTarget, publications.publishOrUpdate)
    .delete(clientHasScope('publications'), isSameTarget, publications.unpublish);

};
