/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Service = mongoose.model('Service');


/*
** Actions
*/
exports.list = function (req, res, next) {
    Service
        .find({ protocol: 'csw' })
        .populate('lastSync', 'status started')
        .populate('lastSuccessfulSync', 'started finished itemsFound')
        .exec(function(err, services) {
            if (err) return next(err);
            res.json(services);
        });
};
