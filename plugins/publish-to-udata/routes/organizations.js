const express = require('express');
const { fetch, list, show, createOrUpdate, showProfile } = require('../controllers/organizations');
const { ensureLoggedIn, isAdminOf } = require('../middlewares');

module.exports = function () {
  const router = express.Router();

  router.param('organizationId', fetch);

  router.route('/organizations/:organizationId')
      .get(show)
      .put(ensureLoggedIn, isAdminOf(req => req.params.organizationId), createOrUpdate);

  router.get('/organizations/:organizationId/profile', showProfile);

  router.get('/organizations', list);

  return router;
};
