const { list, show, createOrUpdate, fetch } = require('../controllers/organizations');
const { ensureLoggedIn, isAdminOf } = require('../middlewares');

module.exports = function (router) {

  router.param('organizationId', fetch);

  router.route('/api/organizations/:organizationId')
      .get(show)
      .put(ensureLoggedIn, isAdminOf(req => req.params.organizationId), createOrUpdate);

  router.route('/api/organizations')
      .get(list);

};
