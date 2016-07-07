var util = require('util');

var _ = require('lodash');
var wfs = require('wfs-client');
var async = require('async');
var debug = require('debug')('harvest:wfs');

var featureTypeMatchings = require('../../matching/featureTypes');
var mongoose = require('../../mongoose');

var ServiceSyncJob = require('../syncJob');

var FeatureType = mongoose.model('FeatureType');

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
        timeout: 25
    });

    client.capabilities().then(function (capabilities) {

        var featureTypesFound;
        var remainingCheckingFeatureTypes;

        function propagateFeatureTypeAvailabilityUpdate(featureType, available) {
            function traceError(err) {
                if (err) console.trace(err);
            }

            featureType.service = service._id;

            if (!available) {
                featureTypeMatchings.dropByFeatureType(featureType, traceError);
            } else {
                featureTypeMatchings.resolveByFeatureType(featureType, traceError);
            }
        }

        function markAvailableFeatureTypesAsChecking(done) {
            var query = { service: service, available: true };
            var changes = { checking: true };

            FeatureType.update(query, { $set: changes }, { multi: true }, function (err, rawResponse) {
                if (err) return done(err);
                if (rawResponse.nModified > 0) {
                    debug('%d available feature type(s) marked as checking', rawResponse.nModified);
                }
                done();
            });
        }

        function markFeatureTypeAsAvailable(featureType, done) {
            var query = { service: service, name: featureType.name };
            var changes = { available: true };

            FeatureType.update(query, { $set: changes }, { upsert: true }, function (err, rawResponse) {
                if (err) return done(err);
                if (rawResponse.nModified === 1) {
                    debug('referenced feature type (%s) is now available', featureType.name);
                    propagateFeatureTypeAvailabilityUpdate(featureType, true);
                }
                if (rawResponse.upserted) {
                    debug('new feature type (%s) discovered', featureType.name);
                    propagateFeatureTypeAvailabilityUpdate(featureType, true);
                }
                done();
            });
        }

        function updateFeatureTypeMetadata(featureType, done) {
            var query = { service: service, name: featureType.name };
            var changes = _.pick(featureType, 'title', 'abstract', 'keywords');
            changes.checking = false;

            FeatureType.update(query, { $set: changes }, function (err) {
                done(err);
            });
        }

        function updateFeatureType(featureType, done) {
            async.series([
                _.partial(markFeatureTypeAsAvailable, featureType),
                _.partial(updateFeatureTypeMetadata, featureType)
            ], done);
        }

        function updateFoundFeatureTypesAndPropagateAvailability(done) {
            var featureTypes = _.filter(capabilities.featureTypes || [], function (featureType) {
                return 'name' in featureType; // Only feature types with name attribute are acceptable
            });
            featureTypesFound = featureTypes.length;
            debug('%d feature type(s) found', featureTypesFound);
            async.each(featureTypes, updateFeatureType, done);
        }

        function markRemainingCheckingFeatureTypesAsUnavailable(done) {
            var query = { service: service, checking: true };
            var changes = { available: false, checking: false };

            FeatureType.update(query, { $set: changes }, { multi: true }, function (err, rawResponse) {
                if (err) return done(err);
                if (rawResponse.nModified > 0) {
                    debug('%d referenced feature type(s) are not available any longer', rawResponse.nModified);
                }
                done();
            });
        }

        function fetchRemainingCheckingFeatureTypes(done) {
            FeatureType
                .find({ service: service, checking: true })
                .select({ name: 1 })
                .lean()
                .exec(function (err, featureTypes) {
                    if (err) return done(err);
                    remainingCheckingFeatureTypes = featureTypes;
                    done();
                });
        }

        function propagateUnavailability(done) {
            remainingCheckingFeatureTypes.forEach(function (featureType) {
                propagateFeatureTypeAvailabilityUpdate(service, featureType.name, false);
            });
            remainingCheckingFeatureTypes = undefined;
            done();
        }

        function updateService(done) {
            var changes = _.pick(capabilities.service, 'abstract', 'keywords');
            changes.name = capabilities.service.title;

            service
                .set(changes)
                .save(done);
        }

        async.series([
            markAvailableFeatureTypesAsChecking,
            updateFoundFeatureTypesAndPropagateAvailability,
            fetchRemainingCheckingFeatureTypes,
            markRemainingCheckingFeatureTypesAsUnavailable,
            propagateUnavailability,
            updateService
        ], function (err) {
            if (err) job.fail(err);
            else job.success(featureTypesFound);
        });

    }, function(e) {
        job.fail(e);
    });
};


/*
** Exports
*/
exports.lookup = function(job, done) {
    (new WfsLookupJob(job, { failsAfter: 60 })).start(done);
};
