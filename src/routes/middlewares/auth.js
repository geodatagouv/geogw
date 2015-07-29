exports.ensureLoggedIn = function(req, res, next) {
    if (!req.user) return res.status(401).end();
    next();
};

exports.isAdmin = function(req, res, next) {
    if (!req.user || !req.user.isAdmin) res.status(401).end();
    next();
};
