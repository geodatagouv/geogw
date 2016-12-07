const { list, show, update, create, fetch } = require('../controllers/organizations');
const { ensureLoggedIn, isAdminOf } = require('../middlewares');

module.exports = function (router) {

  router.param('organizationId', fetch);

  router.route('/api/organizations/:organizationId')
      .get(show)
      .put(ensureLoggedIn, isAdminOf(req => req.params.organizationId), update);

  router.route('/api/organizations')
      .get(list)
      .post(ensureLoggedIn, isAdminOf(req => req.body._id), create);

};
