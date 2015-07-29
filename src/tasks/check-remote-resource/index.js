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
    var isFileDistribution;
    var remoteResource;

    /* Steps */

    function fetchResource(next) {
        RemoteResource
            .findOne({ location: remoteResourceLocation })
            .select('-checkResult')
            .exec(function (err, remoteResourceFound) {
                if (err) return next(err);
                if (!remoteResourceFound) return next(new Error('RemoteResource not found'));
                remoteResource = remoteResourceFound;
                next();
            });
    }

    function checkResource(next) {
        var plunger = new Plunger(remoteResourceLocation, { abort: 'always' });
        plunger
            .inspect()
            .then(function () {
                checkResult = plunger.toObject();
                next();
            }, next);
    }

    function update(next) {
        var now = new Date();

        isFileDistribution = checkResult.archive === 'zip'
        isAvailable = checkResult.statusCode === 200;

        remoteResource
            .set('checkResult', checkResult)
            .set('updatedAt', now)
            .set('touchedAt', now)
            .set('available', isAvailable);

        if (isFileDistribution) {
            remoteResource.set('type', 'file-distribution');
        }

        remoteResource.save(next);
    }

    function propagate(next) {
        var now = new Date();

        function applyToRelated(relatedResource, done) {
            if (relatedResource.remoteResource.available === isAvailable && relatedResource.remoteResource.type === remoteResource.type) {
                return done();
            }

            relatedResource
                .set('remoteResource.available', remoteResource.available)
                .set('remoteResource.type', remoteResource.type)
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
        fetchResource,
        checkResource,
        update,
        propagate
    ];

    async.series(processSequence, done);
};
