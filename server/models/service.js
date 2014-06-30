/*
** Module dependencies
*/
var mongoose = require('mongoose');
var jobs = require('../kue').jobs;
var url = require('url');
var _ = require('lodash');
var _s = require('underscore.string');
var async = require('async');
var Schema = mongoose.Schema;

/*
** Supported protocols
*/
var SUPPORTED_PROTOCOLS = ['csw', 'wfs'];

/*
** Helpers
*/
function cleanLocation(location) {
    location = url.parse(location, true);
    var proto = location.protocol;
    if (!proto) throw new Error('Missing protocol in location');
    if (proto !== 'http:' && proto !== 'https:') throw new Error('Forbidden protocol in location. Use http or https instead');
    if (location.hostname) location.hostname = location.hostname.toLowerCase();
    location.query = _.pick(location.query, 'map');
    location.pathname = _s.rtrim(location.pathname, '/');
    return url.format(_.omit(location, 'search', 'hash', 'path', 'host'));
}

/*
** Service schema
*/
var ServiceSchema = new Schema({
    name: { type: String, trim: true },
    location: { type: String, require: true },
    protocol: { type: String, enum: SUPPORTED_PROTOCOLS, required: true },
    syncEnabled: { type: Boolean, default: true },
    lastSync: { type: Schema.Types.ObjectId, ref: 'ServiceSync' },
    lastSuccessfulSync: { type: Schema.Types.ObjectId, ref: 'ServiceSync' },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
});

/*
** Middlewares
*/
ServiceSchema.pre('validate', function(next) {
    if (!this.location) next();
    try {
        this.location = cleanLocation(this.location);
        next();
    } catch (err) {
        next(err);
    }
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
            console.log('create job');
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

/*
** Attach model
*/
mongoose.model('Service', ServiceSchema);
