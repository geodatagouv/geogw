exports.isMaintenance = function (req, res, next) {
    if (req.query.token && process.env.MAINTENANCE_TOKEN && req.query.token === process.env.MAINTENANCE_TOKEN)
        return next();
    res.status(401).end();
};
