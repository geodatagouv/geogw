var _ = require('lodash');
var csw = require('csw');
var mongoose = require('../mongoose');
var Record = mongoose.model('Record');
var Service = mongoose.model('Service');
var ServiceSync = mongoose.model('ServiceSync');
var moment = require('moment');
var debug = require('debug')('harvest-csw');
var async = require('async');

function processOnlineResource(resource) {
    if (!resource.link) return;
    return resource;
}

function processRecord(record, serviceSync) {
    debug('processing record %s', record.title || record.name || record.fileIdentifier);
    var query = {
        identifier: record.fileIdentifier,
        parentCatalog: serviceSync.service._id
    };

    // Direct copy
    var metadata = _.pick(record, [
        'title',
        'abstract',
        'type',
        'representationType',
        'serviceType',
        'keywords',
        'contacts',
        '_contacts',
        '_updated'
    ]);

    if (metadata._updated) metadata._updated = moment(metadata._updated).toDate();
    if (record.onlineResources) metadata.onlineResources = _.compact(record.onlineResources.map(processOnlineResource));

    var update = { $set: { metadata: metadata, lastSync: serviceSync._id }};

    Record.findOneAndUpdate(query, update, { upsert: true }, function(err) {
        if (err) console.log(err);
    });
}

function harvestService(serviceSync, job, done) {
    var client = csw(serviceSync.service.location, {
        maxSockets: job.data.maxSockets || 5,
        keepAlive: true,
        retry: job.data.maxRetry || 3,
        userAgent: 'Afigeo CSW harvester'
    });

    var harvesterOptions = {
        mapper: 'iso19139',
        constraintLanguage: 'CQL_TEXT'
    };

    if (serviceSync.service.location.indexOf('isogeo') !== -1) harvesterOptions.namespace = 'xmlns(gmd=http://www.isotc211.org/2005/gmd)';
    if (serviceSync.service.location.indexOf('geoportal/csw/discovery') !== -1) delete harvesterOptions.constraintLanguage;

    var harvester = client.harvest(harvesterOptions);

    var total;

    harvester.on('error', function(err) {
        job.log(JSON.stringify(err));
        console.trace(err);
    });

    harvester.on('start', function(stats) {
        total = stats.matched;
        job.log(JSON.stringify(stats));
    });

    harvester.on('page', function(infos) {
        if (infos.announced < infos.found) {
            total -= (infos.announced - infos.found);
            job.log('Notice: %d records found of %d announced!', infos.found, infos.announced);
        }
    });

    harvester.on('end', function(err, stats) {
        if (err) {
            serviceSync.set({
                status: 'failed',
                finished: Date.now()
            }).save(done);
        } else {
            async.parallel([
                function(cb) {
                    serviceSync.set({
                        itemsFound: stats.returned,
                        status: 'successful',
                        finished: Date.now()
                    }).save(cb);
                },
                function(cb) {
                    serviceSync.service.set('lastSuccessfulSync', serviceSync._id).save(cb);
                }
            ], done)
 
        }
    });

    harvester.on('record', function(data) {
        var record = data.record;
        job.progress(data.stats.returned, total);

        if (!record.fileIdentifier) {
            job.log('Dropping 1 record!');
            return;
        }

        process.nextTick(function() {
            processRecord(record, serviceSync);
        });
    });
}

exports.harvest = function(job, done) {
    ServiceSync
        .findById(job.data.serviceSyncId)
        .populate('service')
        .exec(function(err, serviceSync) {
            if (err) return done(err);
            if (!serviceSync) return done(new Error('Unable to fetch serviceSync ' + job.data.serviceSyncId));

            serviceSync.set({
                status: 'processing',
                started: Date.now(),
                jobId: job.id
            }).save(function(err) {
                if (err) return done(err);
                harvestService(serviceSync, job, done);
            });
        });
};
