const mongoose = require('mongoose');

const Service = mongoose.model('Service');

exports.list = function (req, res, next) {
    Service
        .find({ protocol: 'csw' })
        .exec(function(err, services) {
            if (err) return next(err);
            res.json(services);
        });
};
