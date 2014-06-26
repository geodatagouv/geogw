var _ = require('lodash');
var csw = require('csw');
var mongoose = require('../mongoose');
var Record = mongoose.model('Record');
var Service = mongoose.model('Service');
var util = require('util');
var moment = require('moment');

function processRecord(record, service) {
    var query = {
        identifier: record.fileIdentifier,
        parentCatalog: service.id
    };

    var metadata = _.pick(record, [
        'title',
        'abstract',
        'type',
        'representationType',
        'serviceType',
        'keywords',
        'onlineResources',
        'contacts',
        '_contacts',
        '_updated'
    ]);

    if (metadata._updated) metadata._updated = moment(metadata._updated).toDate();

    var update = { $set: { metadata: metadata }};

    Record.findOneAndUpdate(query, update, { upsert: true }, function(err) {
        if (err) console.log(err);
    });
}

function harvestService(service, job, done) {
    var client = csw(service.location, {
        maxSockets: job.data.maxSockets || 5,
        keepAlive: true,
        retry: job.data.maxRetry || 3,
        userAgent: 'Afigeo CSW harvester'
    });

    var harvesterOptions = {
        mapper: 'iso19139',
        constraintLanguage: 'CQL_TEXT'
    };

    if (service.location.indexOf('isogeo') !== -1) harvesterOptions.namespace = 'xmlns(gmd=http://www.isotc211.org/2005/gmd)';
    if (service.location.indexOf('geoportal/csw/discovery') !== -1) delete harvesterOptions.constraintLanguage;

    var startTime = Date.now();

    var harvester = client.harvest(harvesterOptions);

    var total;

    harvester.on('error', function(err) {
        job.log(JSON.stringify(err));
        console.log(util.inspect(err, { showHidden: true, depth: null }));
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
        var endTime = Date.now();

        if (err) {
            console.log(err);
            done(err);
            service
                .set('harvesting.state', 'error')
                .save(function(err) {
                    console.log(err);
                });
        } else {
            service
                .set('harvesting.state', 'idle')
                .set('harvesting.jobId', null)
                .set('harvesting.lastDuration', endTime - startTime)
                .set('harvesting.lastSuccessful', endTime)
                .set('items', stats.returned)
                .save(function(err) {
                    if (err) return done(err);
                    done();
                });
        }
    });

    harvester.on('record', function(data) {
        var record = data.record;
        job.progress(data.stats.returned, total);

        if (!record.fileIdentifier) {
            job.log('Dropping 1 record!');
            return;
        }

        processRecord(record, service);
        
    });
}

exports.harvest = function(job, done) {
    Service.findById(job.data.serviceId, function(err, service) {
        if (err) return done(err);
        if (!service) return done(new Error('Unable to fetch service ' + job.data.serviceId));
        if (!service.harvesting.enabled) return done(new Error('Harvesting is disabled for service ' + job.data.serviceId));
        if (service.harvesting.state !== 'queued') return done(new Error('Unconsistent state for service ' + job.data.serviceId));
        if (service.harvesting.jobId && service.harvesting.jobId !== parseInt(job.id)) return done(new Error('Unconsistent jobId for service ' + job.data.serviceId));

        setTimeout(function() {
            service
                .set('harvesting.state', 'processing')
                .save(function(err) {
                    if (err) return done(err);
                    harvestService(service, job, done);
                });
        }, 2000);
    });
};
