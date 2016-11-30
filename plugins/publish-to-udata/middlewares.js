const { getUserRoleInOrganization } = require('./udata');

function ensureLoggedIn(req, res, next) {
    if (!req.user) return res.sendStatus(401);
    next();
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
  isAdminOf,
  isEditorOf,
};
