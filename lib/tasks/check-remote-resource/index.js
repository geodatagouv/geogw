var mongoose = require('mongoose');
var async = require('async');
var Plunger = require('plunger');

var RemoteResource = mongoose.model('RemoteResource');
var RelatedResource = mongoose.model('RelatedResource');


module.exports = function (job, done) {
    // var remoteResourceId = job.data.remoteResourceId;
    var remoteResourceLocation = job.data.remoteResourceLocation;
    var checkResult;
    var isAvailable;

    /* Steps */

    function checkResource(next) {
        var plunger = new Plunger(remoteResourceLocation, { abort: 'always' });
        plunger
            .inspect()
            .then(function () {
                checkResult = plunger.toObject();
                isAvailable = checkResult.statusCode === 200 && checkResult.archive === 'zip';
                next();
            }, next);
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
