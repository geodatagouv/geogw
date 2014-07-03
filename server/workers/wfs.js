var wfs = require('wfs-client');
var mongoose = require('../mongoose');
var ServiceSync = mongoose.model('ServiceSync');

function lookupService(serviceSync, job, done) {
    var client = wfs(serviceSync.service.location, { 
        userAgent: 'Afigeo WFS harvester',
        queryStringToAppend: serviceSync.service.locationOptions.query
    });

    client.capabilities().then(function(capabilities) {
        console.log(capabilities.featureTypes);
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
