var mongoose = require('mongoose');
var async = require('async');

var checkUrl = require('./checkUrl');

var RemoteResource = mongoose.model('RemoteResource');
var RelatedResource = mongoose.model('RelatedResource');


module.exports = function (job, done) {
    // var remoteResourceId = job.data.remoteResourceId;
    var remoteResourceLocation = job.data.remoteResourceLocation;
    var checkResult;
    var isAvailable;

    /* Steps */

    function checkResource(next) {
        checkUrl(remoteResourceLocation, function (err, result) {
            if (err) return next(err);
            checkResult = result;
            isAvailable = result.statusCode === 200 && result.contentType === 'application/octet-stream';
            next();
        });
    }

    function update(next) {
        var now = new Date();
        var query = { location: remoteResourceLocation };
        var changes = {
            $set: {
                checkResult: checkResult,
                updatedAt: now,
                touchedAt: now,
                available: isAvailable
            }
        };

        RemoteResource.update(query, changes, next);
    }

    function propagate(next) {
        var now = new Date();

        function applyToRelated(relatedResource, done) {
            if (relatedResource.remoteResource.available === isAvailable) return done();

            relatedResource
                .set('remoteResource.available', isAvailable)
                .set('updatedAt', now)
                .save(function (err) {
                    if (err) return done(err);
                    RelatedResource.triggerConsolidation(relatedResource, done);
                });
        }

        RelatedResource.find({ 'remoteResource.location': remoteResourceLocation }, function (err, relatedResources) {
            if (err) return next(err);
            async.each(relatedResources, applyToRelated, next);
        });
    }

    /* Execution */

    var processSequence = [
        checkResource,
        update,
        propagate
    ];

    async.series(processSequence, done);
};
