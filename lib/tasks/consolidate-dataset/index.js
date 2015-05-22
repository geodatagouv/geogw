var mongoose = require('mongoose');
var async = require('async');

var distributions = require('./distributions');

var Record = mongoose.model('Record');
var RelatedResource = mongoose.model('RelatedResource');


module.exports = function (job, done) {
    var hashedId = job.data.hashedId;
    var catalogId = job.data.catalogId;
    var record;
    var relatedResources;
    var dist = [];

    /* Steps */

    function fetchRecord(next) {
        Record.findOne({ hashedId: hashedId, parentCatalog: catalogId }, function (err, result) {
            if (err) return next(err);
            if (!result) return next(new Error('Record not found'));
            record = result;
            next();
        });
    }

    function fetchRelatedResources(next) {
        RelatedResource.find({ record: hashedId, originCatalog: catalogId }, function (err, result) {
            if (err) return next(err);
            relatedResources = result;
            next();
        });
    }

    function buildDistributions(next) {
        relatedResources.forEach(function (resource) {
            if (resource.type === 'feature-type') {
                var distribution = distributions.buildFeatureType(resource);
                if (distribution) dist.push(distribution);
            }
        });
        next();
    }

    function finishAndSave(next) {
        record
            .set('dataset.distributions', dist)
            .set('dataset.updatedAt', new Date())
            .computeFacets()
            .save(next);
    }

    /* Execution */

    var processSequence = [
        fetchRecord,
        fetchRelatedResources,
        buildDistributions,
        finishAndSave
    ];

    async.series(processSequence, done);
};
