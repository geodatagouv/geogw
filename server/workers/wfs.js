var _ = require('lodash');
var wfs = require('wfs-client');
var mongoose = require('../mongoose');
var ServiceSync = mongoose.model('ServiceSync');
var FeatureType = mongoose.model('FeatureType');

function lookupService(serviceSync, job, done) {
    var client = wfs(serviceSync.service.location, { 
        userAgent: 'Afigeo WFS harvester',
        queryStringToAppend: serviceSync.service.locationOptions.query
    });

    client.capabilities().then(function(capabilities) {
        // Basic mapping
        var serviceUpdate = _.pick(capabilities.service, 'abstract', 'keywords');
        if (capabilities.service.title) serviceUpdate.name = capabilities.service.title;
        serviceSync.service
            .set(serviceUpdate)
            .save(function(err) {
                if (err) console.trace(err);
            });

        capabilities.featureTypes.forEach(function(rawFeatureType) {
            if (!rawFeatureType.name) return;

            var query = {
                service: serviceSync.service,
                name: rawFeatureType.name
            };

            var newFeatureType = _.pick(rawFeatureType, 'title', 'abstract', 'keywords');
            newFeatureType.lastSync = serviceSync._id;

            FeatureType.findOneAndUpdate(query, { $set: newFeatureType }, { upsert: true }, function(err) {
                if (err) console.trace(err);
            });
        });
        serviceSync.toggleSuccessful(capabilities.featureTypes.length, done);
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
