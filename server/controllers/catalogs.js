/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Service = mongoose.model('Service');
var CswRecord = mongoose.model('CswRecord');


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

exports.showRecordHistory = function (req, res, next) {
    var syncSelect = '-__v -service -jobId -log';
    CswRecord
        .find({ identifier: req.params.identifier, parentCatalog: req.service._id })
        .sort('-timestamp')
        .populate('synchronizations', syncSelect)
        .select('-xml')
        .lean()
        .exec(function (err, records) {
            if (err) return next(err);
            res.json(records);
        });
};

exports.downloadRecordSnapshot = function (req, res, next) {
    CswRecord
        .findById(req.params.snapshotId)
        .select('xml')
        .lean()
        .exec(function (err, record) {
            if (err) return next(err);
            console.log(record);
            res.type('application/xml');
            res.send(record.xml);
        });
};
