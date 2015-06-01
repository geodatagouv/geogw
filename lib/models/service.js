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
        itemsFound: { type: Number },
        finishedAt: { type: Date, index: true }
    },

    syncEnabled: { type: Boolean, default: true }
});


/*
** Statics
*/
ServiceSchema.statics = {

    triggerSync: function (service, freshness, done) {
        if (!done) {
            done = freshness;
            freshness = 0;
        }

        if (!service._id) return done(new Error('_id is not defined'));
        if (!service.protocol) return done(new Error('protocol is not defined'));
        if (!service.location) return done(new Error('location is not defined'));

        var minFinishedAtAcceptable = new Date(Date.now() - freshness);

        if (service.sync && service.sync.finishedAt && service.sync.finishedAt > minFinishedAtAcceptable) {
            return done();
        }

        var Service = this;
        var ServiceSync = mongoose.model('ServiceSync');

        var query = {
            _id: service._id,
            syncEnabled: true,
            'sync.pending': false,
            'sync.processing': false,
            'sync.finishedAt': { $lt: minFinishedAtAcceptable }
        };

        var changes = {
            $set: { 'sync.pending': true }
        };

        Service.update(query, changes, function (err, rawResult) {
            if (err) return done(err);

            var serviceName = service.name || service._id;

            if (rawResult.nModified === 0) {
                debug('synchronization ignored for %s', serviceName);
                return done();
            }

            debug('synchronization queued for %s', serviceName);

            function createServiceSync(cb) {
                ServiceSync.create({ service: service._id, status: 'queued' }, cb);
            }

            function createJob(cb) {
                var job = jobs.create(supportedProtocols[service.protocol].syncTask, {
                    title: service.name || 'not defined',
                    serviceUrl: service.location || 'not defined',
                    serviceId: service._id,
                    protocol: service.protocol || 'not defined'
                });

                if (process.env.NODE_ENV === 'production') {
                    job.removeOnComplete(true);
                }

                job.save(cb);
            }

            async.series([createServiceSync, createJob], done);
        });
    },

    upsert: function (service, done) {
        var Service = this;

        if (!service.protocol) return done(new Error('protocol is not defined'));
        if (!service.location) return done(new Error('location is not defined'));

        var query = _.pick(service, 'location', 'protocol');

        var changes = {
            $setOnInsert: {
                syncEnabled: true,
                sync: {
                    status: 'new',
                    processing: false,
                    pending: false,
                    finishedAt: new Date(1970)
                }
            }
        };

        Service.update(query, changes, { upsert: true }, function (err, rawResponse) {
            if (err) return done(err);
            if (rawResponse.upserted) {
                service._id = rawResponse.upserted[0]._id;

                Service.triggerSync(service, function (err) {
                    if (err) console.log(err);
                    done(null, service._id);
                });
            } else {
                done();
            }
        });
    }

};


/*
** Methods
*/
ServiceSchema.methods.doSync = function(freshness, done) {
    mongoose.model('Service').triggerSync(this, freshness, done);
};

ServiceSchema.methods.toggleSyncStatus = function (status, itemsFound, done) {
    if (!done) {
        done = itemsFound;
        itemsFound = 0;
    }

    this
        .set('sync.status', status)
        .set('sync.pending', false)
        .set('sync.processing', false)
        .set('sync.finishedAt', new Date())
        .set('sync.itemsFound', itemsFound || 0)
        .save(done);
};


/*
** Attach model
*/
mongoose.model('Service', ServiceSchema);
