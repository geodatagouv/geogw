exports.ensureLoggedIn = function(req, res, next) {
    if (!req.user) return res.status(401).end();
    next();
};

exports.isAdmin = function(req, res, next) {
    if (!req.user || !req.user.isAdmin) res.status(401).end();
    next();
};

exports.isMaintenance = function (req, res, next) {
    if (req.user && req.user.isAdmin) return next();
    if (req.query.token && process.env.MAINTENANCE_TOKEN && req.query.token === process.env.MAINTENANCE_TOKEN)
        return next();
    res.status(401).end();
};
