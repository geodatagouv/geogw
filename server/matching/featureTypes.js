var async = require('async');
var _ = require('lodash');
var _s = require('underscore.string');
var mongoose = require('mongoose');
var debug = require('debug')('matching:feature-type');

var RelatedResource = mongoose.model('RelatedResource');

exports.dropByFeatureType = function (featureType, done) {
    var query = {
        type: 'feature-type',
        'featureType.matchingService': featureType.service,
        'featureType.matchingName': featureType.name
    };
    var changes = {
        $set: { updated: true },
        $unset: { 'featureType.matchingName': 1 }
    };

    RelatedResource.update(query, changes, { multi: true }, function (err, rawResponse) {
        if (err) return done(err);
        if (rawResponse.nModified) {
            debug('drop %d matchings for %s', rawResponse.nModified, featureType.name);
        }
        done();
    });
};

exports.resolveByFeatureType = function (featureType, done) {
    function normalize(typeName) {
        return _s(typeName).toUpperCase().strRight(':').value();
    }

    var referenceNormalizedTypeName = normalize(featureType.name);
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

    function match(candidateName) {
        candidateName = normalize(candidateName);
        return candidateName === referenceNormalizedTypeName;
    }

    function resolve(relatedResource, done) {
        var query = {
            _id: relatedResource._id,
            'featureType.matchingService': featureType.service,
            'featureType.matchingName': { $exists: false }
        };
        var changes = {
            $set: {
                'featureType.matchingName': featureType.name,
                updated: true
            }
        };

        RelatedResource.update(query, changes, function (err, rawResponse) {
            if (err) return done(err);
            if (rawResponse.nModified > 0) {
                debug('%s match with %s', relatedResource.featureType.candidateName, featureType.name);
            }
            done();
        });
    }

    function resolveMatchingOnes(done) {
        var matchingOnes = _.filter(notResolvedRelatedResources, function (relatedResource) {
            return match(relatedResource.featureType.candidateName);
        });

        async.each(matchingOnes, resolve, done);
    }

    async.series([fetchNotResolvedRelatedResources, resolveMatchingOnes], done);

};
