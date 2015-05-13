/*
** Module dependencies
*/
var mongoose = require('mongoose');
var _ = require('lodash');
var jobs = require('../kue').jobs;
var async = require('async');
var debug = require('debug')('model:service');

var Schema = mongoose.Schema;
var csw = require('./serviceTypes/csw');
var wfs = require('./serviceTypes/wfs');
var wms = require('./serviceTypes/wms');

/*
** Supported protocols
*/
var supportedProtocols = { csw: csw, wfs: wfs, wms: wms };

var SYNC_STATUSES = ['new', 'successful', 'failed'];

/*
** Service schema
*/
var ServiceSchema = new Schema({

    location: { type: String, required: true },
    protocol: { type: String, enum: _.keys(supportedProtocols), required: true },

    /* Context */
    name: { type: String, trim: true },
    abstract: { type: String },
    keywords: { type: [String] },

    /* Synchronization */
    sync: {
        status: { type: String, enum: SYNC_STATUSES, index: true, required: true },
        pending: { type: Boolean },
        processing: { type: Boolean },
        finishedAt: { type: Date, index: true }
    },

    syncEnabled: { type: Boolean, default: true }
});

/*
** Methods
*/
ServiceSchema.methods.doSync = function(freshness, done) {
    var Service = mongoose.model('Service');
    var ServiceSync = mongoose.model('ServiceSync');
    var service = this;

    var query = {
        _id: service._id,
        syncEnabled: true,
        'sync.pending': false,
        'sync.processing': false,
        'sync.finishedAt': { $lt: new Date(Date.now() - freshness) }
    };

    var changes = {
        $set: { 'sync.pending': true }
    };

    Service.update(query, changes, function (err, rawResult) {
        if (err) return done(err);

        if (rawResult.nModified === 0) {
            debug('synchronization ignored for %s', service.name || service._id);
            return done();
        }

        debug('synchronization queued for %s', service.name || service._id);

        function createServiceSync(cb) {
            ServiceSync.create({ service: service, status: 'queued' }, cb);
        }

        function createJob(cb) {
            var job = jobs.create(supportedProtocols[service.protocol].syncTask, {
                title: service.name,
                serviceUrl: service.location,
                serviceId: service.id,
                protocol: service.protocol
            });

            if (process.env.NODE_ENV === 'production') {
                job.removeOnComplete(true);
            }

            job.save(cb);
        }

        async.parallel([createServiceSync, createJob], done);

    });

};

ServiceSchema.methods.toggleSyncStatus = function (status, done) {
    this
        .set('sync.status', status)
        .set('sync.pending', false)
        .set('sync.processing', false)
        .set('sync.finishedAt', new Date())
        .save(done);
};

/*
** Attach model
*/
mongoose.model('Service', ServiceSchema);
