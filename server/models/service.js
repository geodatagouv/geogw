/*
** Module dependencies
*/
var mongoose = require('mongoose');
var jobs = require('../kue').jobs;
var _ = require('lodash');
var async = require('async');
var Schema = mongoose.Schema;
var csw = require('./serviceTypes/csw');
var wfs = require('./serviceTypes/wfs');
var wms = require('./serviceTypes/wms');

/*
** Supported protocols
*/
var supportedProtocols = { csw: csw, wfs: wfs, wms: wms };

/*
** Service schema
*/
var ServiceSchema = new Schema({
    name: { type: String, trim: true },
    location: { type: String, required: true },
    locationOptions: {
        query: Schema.Types.Mixed
    },
    protocol: { type: String, enum: _.keys(supportedProtocols), required: true },
    syncEnabled: { type: Boolean, default: true },
    lastSync: { type: Schema.Types.ObjectId, ref: 'ServiceSync' },
    lastSuccessfulSync: { type: Schema.Types.ObjectId, ref: 'ServiceSync' },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
});

/*
** Indexes
*/
ServiceSchema.index({ location: 1, protocol: 1 }, { unique: true } );

/*
** Middlewares
*/
ServiceSchema.pre('validate', function(next) {
    try {
        if ((this.protocol in supportedProtocols) && this.isModified('location')) {
            var parsedLocation = supportedProtocols[this.protocol].parseLocation(this.location);
            _.extend(this, parsedLocation);
        }
        next();
    } catch(err) {
        next(err);
    }
});

/*
** Virtuals
*/
ServiceSchema.virtual('syncable').get(function() {
    return this.syncEnabled && this.protocol && supportedProtocols[this.protocol].syncable;
});

/*
** Methods
*/
ServiceSchema.methods.createSync = function(done) {
    if ((this.lastSync && _.contains(['queued', 'processing'], this.lastSync.status)) || !this.syncEnabled) return done();

    var service = this;
    var ServiceSync = this.model('ServiceSync');

    async.waterfall([
        function(cb) {
            ServiceSync.create({ service: service, status: 'queued' }, cb);
        },
        function(serviceSync, cb) {
            service.lastSync = serviceSync._id;
            service.save(function(err) {
                if (err) return cb(err);
                cb(null, serviceSync);
            });
        },
        function(serviceSync, cb) {
            jobs.create('service-sync', {
                title: service.name,
                serviceUrl: service.location,
                serviceId: service.id,
                protocol: service.protocol,
                serviceSyncId: serviceSync.id
            }).save(cb);
        }
    ], done);
};

/*
** Static methods
*/
ServiceSchema.statics = {

    findByLocationAndProtocol: function(location, protocol, done) {
        if (!(protocol in supportedProtocols)) return done(new Error('Protocol not supported'));
        var parsedLocation = supportedProtocols[protocol].parseLocation(location);
        this.findOne({ location: parsedLocation.location, protocol: protocol }, done);
    }

};

/*
** Options
*/
ServiceSchema.set('toObject', { virtuals: true });
ServiceSchema.set('toJSON', { virtuals: true });

/*
** Attach model
*/
mongoose.model('Service', ServiceSchema);
