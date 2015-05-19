var async = require('async');
var _ = require('lodash');
var _s = require('underscore.string');
var mongoose = require('mongoose');
var debug = require('debug')('matching:feature-type');

var RelatedResource = mongoose.model('RelatedResource');
var FeatureType = mongoose.model('FeatureType');

function dropByFeatureType(featureType, done) {
    var query = {
        type: 'feature-type',
        'featureType.matchingService': featureType.service,
        'featureType.matchingName': featureType.name
    };
    var changes = {
        $set: { updatedAt: new Date() },
        $unset: { 'featureType.matchingName': 1 }
    };

    RelatedResource.update(query, changes, { multi: true }, function (err, rawResponse) {
        if (err) return done(err);
        if (rawResponse.nModified) {
            debug('drop %d matchings for %s', rawResponse.nModified, featureType.name);
        }
        done();
    });
}

function normalizeTypeName(typeName) {
    return _s(typeName).toUpperCase().strRight(':').value();
}

function match(candidateName, referenceName) {
    return candidateName === referenceName;
}

function resolveOne(relatedResource, typeName, done) {
    var query = {
        _id: relatedResource._id,
        'featureType.matchingService': relatedResource.featureType.matchingService,
        'featureType.matchingName': { $exists: false }
    };
    var changes = {
        $set: {
            'featureType.matchingName': typeName,
            updatedAt: new Date()
        }
    };

    RelatedResource.update(query, changes, function (err, rawResponse) {
        if (err) return done(err);
        if (rawResponse.nModified > 0) {
            debug('%s match with %s', relatedResource.featureType.candidateName, typeName);
        }
        done();
    });
}

function resolveByFeatureType(featureType, done) {

    var referenceNormalizedTypeName = normalizeTypeName(featureType.name);
    var notResolvedRelatedResources;

    function fetchNotResolvedRelatedResources(done) {
        RelatedResource
            .find({
                type: 'feature-type',
                'featureType.matchingService': featureType.service,
                'featureType.matchingName': { $exists: false }
            })
            .lean()
            .exec(function (err, relatedResources) {
                if (err) return done(err);
                if (relatedResources.length) {
                    debug('found %d not resolved related resources for service %s', relatedResources.length, featureType.service);
                }
                notResolvedRelatedResources = relatedResources;
                done();
            });
    }

    function resolveMatchingOnes(done) {
        var matchingOnes = _.filter(notResolvedRelatedResources, function (relatedResource) {
            return match(normalizeTypeName(relatedResource.featureType.candidateName), referenceNormalizedTypeName);
        });

        function resolve(relatedResource, itemDone) {
            resolveOne(relatedResource, featureType.name, itemDone);
        }

        async.each(matchingOnes, resolve, done);
    }

    async.series([fetchNotResolvedRelatedResources, resolveMatchingOnes], done);

}

function resolveByRelatedResource(relatedResource, done) {

    var referenceNormalizedTypeName = normalizeTypeName(relatedResource.featureType.candidateName);
    var typeNames;

    function fetchFeatureTypeNames(done) {
        FeatureType
            .find({
                service: relatedResource.featureType.matchingService,
                available: true
            })
            .select({ name: 1 })
            .lean()
            .exec(function (err, featureTypes) {
                if (err) return done(err);
                typeNames = _.pluck(featureTypes, 'name');
                done();
            });
    }

    function findMatchingAndResolve(done) {
        var matchingTypeName = _.find(typeNames, function (candidateTypeName) {
            return match(normalizeTypeName(candidateTypeName), referenceNormalizedTypeName);
        });

        if (matchingTypeName) {
            resolveOne(relatedResource, matchingTypeName, done);
        } else {
            debug('no matching feature type name for the following candidate: %s', relatedResource.featureType.candidateName);
            done();
        }
    }

    async.series([fetchFeatureTypeNames, findMatchingAndResolve], done);

}

exports.normalizeTypeName = normalizeTypeName;
exports.match = match;
exports.dropByFeatureType = dropByFeatureType;
exports.resolveOne = resolveOne;
exports.resolveByFeatureType = resolveByFeatureType;
exports.resolveByRelatedResource = resolveByRelatedResource;
