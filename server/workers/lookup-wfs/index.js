/*
** Module dependencies
*/
var util = require('util');
var _ = require('lodash');
var _s = require('underscore.string');
var wfs = require('wfs-client');
var mongoose = require('../../mongoose');
var Record = mongoose.model('Record');
var debug = require('debug')('sync-wfs');
var ServiceSyncJob = require('../syncJob');


function updateRelatedRecords(service, done) {
    var featureTypes = _.flatten(service.featureTypes.map(function(featureType) {
        if (featureType.name.indexOf(':')) {
            return [featureType.name.toLowerCase(), _s.strRight(featureType.name.toLowerCase(), ':')];
        } else {
            return featureType.name.toLowerCase();
        }
    }));

    Record
        .findByRelatedService(service)
        .stream()
        .on('data', function(record) {
            _.where(record.relatedServices, { service: service._id }).forEach(function(matchingRelatedService) {
                if (_.contains(featureTypes, matchingRelatedService.name)) {
                    matchingRelatedService.status = 'ok';
                } else {
                    matchingRelatedService.status = 'unreachable';
                }
                debug('record %s references service %s (featureType: %s) with status %s', record.metadata.title, service.name, matchingRelatedService.name, matchingRelatedService.status);
            });
            record.save(function(err) {
                if (err) console.log(err);
            });
        })
        .on('close', function() {
            done();
        });
}


/*
** Constructor
*/
function WfsLookupJob(job) {
    ServiceSyncJob.call(this, job);
}

util.inherits(WfsLookupJob, ServiceSyncJob);


/*
** Sync method
*/
WfsLookupJob.prototype._sync = function () {
    var service = this.service;
    var job = this;

    var client = wfs(service.location, { 
        userAgent: 'Afigeo WFS harvester',
        queryStringToAppend: service.locationOptions.query
    });

    client.capabilities().then(function(capabilities) {
        // Basic mapping
        var serviceUpdate = _.pick(capabilities.service, 'abstract', 'keywords');
        if (capabilities.service.title) serviceUpdate.name = capabilities.service.title;
        if (capabilities.featureTypes) serviceUpdate.featureTypes = capabilities.featureTypes;
        service
            .set(serviceUpdate)
            .save(function(err) {
                if (err) console.trace(err);
            });
        updateRelatedRecords(service, function () {
            job.success(capabilities.featureTypes ? capabilities.featureTypes.length : 0);
        });
    }, function(e) {
        job.fail(e);
    });
};


/*
** Exports
*/
exports.lookup = function(job, done) {
    (new WfsLookupJob(job)).start(done);
};
