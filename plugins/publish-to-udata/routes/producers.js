const { list, associate, dissociate, fetch, listByOrganization } = require('../controllers/producers');
const { ensureLoggedIn, isAdminOf, organizationIsSet } = require('../middlewares');

module.exports = function (router) {

  router.param('producerId', fetch);

  router.route('/api/producers')
      .get(list);

  /* Associations */

  router.route('/api/organizations/:organizationId/producers')
      .post(ensureLoggedIn, organizationIsSet, isAdminOf(req => req.params.organizationId), associate)
      .get(listByOrganization);

  router.route('/api/organizations/:organizationId/producers/:producerId')
      .delete(ensureLoggedIn, organizationIsSet, isAdminOf(req => req.params.organizationId), dissociate);

};
