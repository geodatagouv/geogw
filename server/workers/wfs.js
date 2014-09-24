var _ = require('lodash');
var _s = require('underscore.string');
var wfs = require('wfs-client');
var mongoose = require('../mongoose');
var ServiceSync = mongoose.model('ServiceSync');
var Record = mongoose.model('Record');
var debug = require('debug')('sync-wfs');

var updateRelatedRecords = function(service, done) {
    var featureTypes = _.flatten(service.featureTypes.map(function(featureType) {
        if (featureType.name.indexOf(':')) {
            return [featureType.name.toLowerCase(), _s.strRight(featureType.name.toLowerCase(), ':')];
        } else {
            return featureType.name.toLowerCase();
        }
    }));

    console.log(featureTypes);

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
            })
        })
        .on('close', function() {
            done();
        });
};

function lookupService(serviceSync, job, done) {
    var client = wfs(serviceSync.service.location, { 
        userAgent: 'Afigeo WFS harvester',
        queryStringToAppend: serviceSync.service.locationOptions.query
    });

    client.capabilities().then(function(capabilities) {
        // Basic mapping
        var serviceUpdate = _.pick(capabilities.service, 'abstract', 'keywords');
        if (capabilities.service.title) serviceUpdate.name = capabilities.service.title;
        if (capabilities.featureTypes) serviceUpdate.featureTypes = capabilities.featureTypes;
        serviceSync.service
            .set(serviceUpdate)
            .save(function(err) {
                if (err) console.trace(err);
            });
        serviceSync.toggleSuccessful(capabilities.featureTypes.length, function(err) {
            if (err) return done(err);
            updateRelatedRecords(serviceSync.service, done);
        });
    }, function(e) {
        console.trace(e);
        serviceSync.toggleError(function(err) {
            if (err) {
                console.trace(err);
                job.log('Unable to persist status `failed`. Error has been traced to console');
            }
            done(e);
        });
    });
}

exports.lookup = function(job, done) {
    ServiceSync.findByIdAndProcess(job.data.serviceSyncId, job.id, function(err, serviceSync) {
        if (err) return done(err);
        lookupService(serviceSync, job, done);
    });
};
