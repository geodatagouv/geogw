/*
** Module dependencies
*/
var es = require('event-stream');
var mongoose = require('mongoose');

var jobs = require('../kue').jobs;

var Service = mongoose.model('Service');
var CswRecord = mongoose.model('CswRecord');
var Record = mongoose.model('Record');


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
            res.type('application/xml');
            res.send(record.xml);
        });
};

exports.forceReprocessAll = function (req, res) {
    var count = 0;
    Record
        .find({ parentCatalog: req.service._id })
        .select({ identifier: 1 })
        .lean()
        .stream()
        .pipe(es.map(function (record, cb) {
            jobs
                .create('process-record', {
                    recordId: record.identifier,
                    catalogId: req.service._id
                })
                .removeOnComplete(true)
                .attempts(5)
                .save(function (err) {
                    if (err) return cb(err);
                    count++;
                    cb();
                });
        }))
        .on('error', function (err) {
            console.trace(err);
        })
        .on('end', function () {
            res.send({ count: count });
        });
};
