const { list, show, createOrUpdate, fetch, showProfile } = require('../controllers/organizations');
const { ensureLoggedIn, isAdminOf } = require('../middlewares');

module.exports = function (router) {

  router.param('organizationId', fetch);

  router.route('/api/organizations/:organizationId')
      .get(show)
      .put(ensureLoggedIn, isAdminOf(req => req.params.organizationId), createOrUpdate);

  router.get('/api/organizations/:organizationId/profile', showProfile);

  router.route('/api/organizations')
      .get(list);

};
