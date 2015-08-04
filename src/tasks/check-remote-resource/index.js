var mongoose = require('mongoose');
var async = require('async');
var Checker = require('./checker');

var RemoteResource = mongoose.model('RemoteResource');
var RelatedResource = mongoose.model('RelatedResource');


module.exports = function (job, jobDone) {
    // var remoteResourceId = job.data.remoteResourceId;
    var remoteResourceLocation = job.data.remoteResourceLocation;
    var checkResult;
    var isAvailable;
    var isFileDistribution;
    var remoteResource;

    /* Steps */

    function fetchModel(next) {
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
        var plunger = new Checker(remoteResourceLocation, { abort: 'never' });

        plunger
            .inspect()
            .then(() => {
                checkResult = plunger.toObject();

                if (plunger.isArchive()) {
                    return plunger.saveArchive()
                        .then(path => job.log('Saved at %s!', path))
                        .then(() => plunger.decompressArchive())
                        .then(path => job.log('Decompressed at %s!', path))
                        .then(() => plunger.listFiles())
                        .then(files => {
                            remoteResource
                                .set('archive.files', files.all)
                                .set('archive.datasets', files.datasets);

                            isAvailable = true;
                            isFileDistribution = files.datasets.length > 0;
                        })
                        .finally(() => plunger.cleanup());
                } else {
                    plunger.closeConnection(true);
                    isFileDistribution = false;
                    isAvailable = plunger.statusCode === 200;
                }
            })
            .nodeify(next);
    }

    function update(next) {
        var now = new Date();

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
        fetchModel,
        checkResource,
        update,
        propagate
    ];

    async.series(processSequence, jobDone);
};
