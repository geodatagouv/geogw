const publications = require('../controllers/publications');

module.exports = function (app) {

  app.param('publicationTarget', publications.publication);

  app.route('/records/:recordId/publications/:publicationTarget')
    .get(publications.show)
    .put(publications.publishOrUpdate)
    .delete(publications.unpublish);

};
