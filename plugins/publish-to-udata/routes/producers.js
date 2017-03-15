const express = require('express');
const { list, associate, dissociate, listByOrganization } = require('../controllers/producers');
const { ensureLoggedIn, isAdminOf, organizationIsSet } = require('../middlewares');

module.exports = function () {
  const router = express.Router();

  router.get('/producers', list);

  /* Associations */

  router.route('/organizations/:organizationId/producers')
      .post(ensureLoggedIn, organizationIsSet, isAdminOf(req => req.params.organizationId), associate)
      .get(listByOrganization);

  router.route('/organizations/:organizationId/producers/:producerId')
      .delete(ensureLoggedIn, organizationIsSet, isAdminOf(req => req.params.organizationId), dissociate);

  return router;
};
