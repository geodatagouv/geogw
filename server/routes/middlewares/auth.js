exports.ensureLoggedIn = function(req, res, next) {
    if (!req.user) return res.send(401);
    next();
};

exports.isAdmin = function(req, res, next) {
    if (!req.user || !req.user.isAdmin) res.send(401);
    next();
};
