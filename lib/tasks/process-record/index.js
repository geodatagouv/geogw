/*
** Module dependencies
*/
var async = require('async');
var _ = require('lodash');
var debug = require('debug')('process-record');

var mongoose = require('../../mongoose');
var organizations = require('./organizations');
var OnlineResource = require('./onlineResources').OnlineResource;

var Record = mongoose.model('Record');
var RelatedResource = mongoose.model('RelatedResource');


module.exports = function(job, done) {
    var hashedId = job.data.hashedId;
    var catalogId = job.data.catalogId;
    var record;

    function fetchRecord(next) {
        Record
            .findOne({ hashedId: hashedId, parentCatalog: catalogId })
            .exec(function (err, response) {
                if (err) return next(err);
                if (!response) return done(new Error('Record not found'));
                record = response;
                next();
            });
    }

    function applyChanges(next) {
        // Process representationType
        if (record.metadata.representationType === 'raster') {
            // TODO: Warn catalog owner
            record.metadata.representationType = 'grid';
        }

        // Process organizations
        function normalizeOrganization(contact) {
            var originalName = contact.organizationName;
            if (!originalName) return;
            if (!organizations[originalName]) return originalName;
            if (organizations[originalName].reject) return; // TODO: Warn catalog owner
            if (organizations[originalName].rename) return organizations[originalName].rename;
        }

        var normalizedOrganizations = _.chain([record.metadata.contacts, record.metadata._contacts])
            .flatten()
            .compact()
            .map(normalizeOrganization)
            .compact()
            .uniq()
            .valueOf();

        record.set('organizations', normalizedOrganizations);

        next();
    }

    function markExistingRelatedResourcesAsChecking(next) {
        RelatedResource.markAsChecking({ originId: record._id }, next);
    }

    function removeCheckingRelatedResources(next) {
        RelatedResource.remove({ originId: record._id, checking: true }, next);
    }

    function processOnlineResources(next) {
        debug('process online resources');

        if (record.metadata.type === 'service') return next();
        if (!record.metadata.onlineResources) return next();

        async.each(record.metadata.onlineResources, function (rawOnlineResource, done) {
            var resource;

            try {
                resource = new OnlineResource(rawOnlineResource);
            } catch (err) {
                // console.trace(err);
                // console.error(rawOnlineResource);
                return done();
            }

            if (resource.isWfsFeatureType()) {
                var relatedResource = {
                    record: record.hashedId,
                    originId: record._id,
                    originType: 'gmd:onLine',
                    originCatalog: record.parentCatalog,
                    featureType: {
                        candidateName: resource.getFeatureTypeName(),
                        candidateLocation: resource.getNormalizedWfsServiceLocation()
                    }
                };

                return RelatedResource.upsertFeatureType(relatedResource, done);
            }

            if (resource.isWellKnownService()) {
                // Do nothing
                return done();
            }

            // Else
            return done();

        }, next);
    }

    function finalSave(next) {
        record
            .computeFacets()
            .save(next);
    }

    function executeTriggers(next) {
        Record.triggerConsolidateAsDataset(record, next);
    }

    var seq = [
        fetchRecord,
        applyChanges,
        markExistingRelatedResourcesAsChecking,
        processOnlineResources,
        removeCheckingRelatedResources,
        finalSave,
        executeTriggers
    ];

    async.series(seq, done);
};
