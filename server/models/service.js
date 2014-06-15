/*
** Module dependencies
*/
var mongoose = require('mongoose');
var jobs = require('../kue').jobs;
var url = require('url');
var _ = require('lodash');
var _s = require('underscore.string');
var Schema = mongoose.Schema;

/*
** Supported protocols
*/
var SUPPORTED_PROTOCOLS = ['csw'];

/*
** Harvesting states
*/
var HARVESTING_STATES = ['idle', 'queued', 'processing', 'error'];

/*
** Helpers
*/
function cleanLocation(location) {
    location = url.parse(location);
    var proto = location.protocol;
    if (!proto) throw new Error('Missing protocol in location');
    if (proto !== 'http:' && proto !== 'https:') throw new Error('Forbidden protocol in location. Use http or https instead');
    if (!proto) location.protocol = 'http:';
    if (location.hostname) location.hostname = location.hostname.toLowerCase();

    return _s.rtrim(url.format(_.omit(location, 'query', 'search', 'hash', 'path', 'host')), '/');
}

/*
** Service schema
*/
var ServiceSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        require: true,
        unique: true // Unique key should be couple location/protocol
    },
    protocol: {
        type: String,
        enum: SUPPORTED_PROTOCOLS,
        required: true
    },
    aliases: {
        type: [String],
        index: true
    },
    harvesting: {
        jobId: {
            type: Number,
        },
        enabled: {
            type: Boolean,
            default: true
        },
        state: {
            type: String,
            default: 'idle',
            enum: HARVESTING_STATES
        },
        lastDuration: {
            type: Number
        },
        lastSuccessful: {
            type: Date
        }
    },
    items: {
        type: Number
    },
    addedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    addedAt: {
        type: Date
    }
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

ServiceSchema.pre('save', function(next) {
    if (this.isNew && !this.addedAt) this.addedAt = Date.now();
    next();
});

/*
** Methods
*/
ServiceSchema.methods.harvest = function(cb) {
    if (this.harvesting.state === 'queued' || this.harvesting.state === 'processing') return cb();
    if (this.harvesting.enabled === false) return cb();

    var service = this;
    this.harvesting.state = 'queued';

    this.save(function(err) {
        if (err) return cb(err);

        jobs.create('harvest', {
            title: service.name,
            serviceUrl: service.location,
            serviceId: service.id,
            protocol: service.protocol
        }).save(function(err) {
            if (err) return cb(err);
            cb();
        });
    });
};

/*
** Static methods
*/
ServiceSchema.statics.findByLocation = function(location) {
    return this.findOne({ location: cleanLocation(location) });
};

/*
** Attach model
*/
mongoose.model('Service', ServiceSchema);
