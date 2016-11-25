const { pluck } = require('lodash');
const Promise = require('bluebird');
const { getUserRoleInOrganization } = require('./udata');

function ensureLoggedIn(req, res, next) {
    if (!req.user) return res.sendStatus(401);
    next();
}

function extractIsAdminOf(req, res, next) {
  Promise.filter(pluck(req.user.organizations, 'id'), organizationId => {
    return getUserRoleInOrganization(req.user.id, organizationId)
      .then(userRole => userRole === 'admin');
  }).then(isAdminOf => {
    req.isAdminOf = isAdminOf;
    next();
  }).catch(next);
}

function isAdminOf(organizationIdExtractor) {
  return (req, res, next) => {
    const organizationId = organizationIdExtractor(req);
    getUserRoleInOrganization(req.user.id, organizationId)
      .then(userRole => {
        if (userRole === 'admin') return next();
        res.sendStatus(403);
      })
      .catch(next);
  };
}

function isEditorOf(organizationIdExtractor) {
  return (req, res, next) => {
    const organizationId = organizationIdExtractor(req);
    getUserRoleInOrganization(req.user.id, organizationId)
      .then(userRole => {
        if (['admin', 'editor'].includes(userRole)) return next();
        res.sendStatus(403);
      })
      .catch(next);
  };
}

module.exports = {
  ensureLoggedIn,
  extractIsAdminOf,
  isAdminOf,
  isEditorOf,
};
