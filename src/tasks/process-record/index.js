/*
** Module dependencies
*/
var async = require('async');
var _ = require('lodash');
var _s = require('underscore.string');
var debug = require('debug')('process-record');

var mongoose = require('../../mongoose');
var organizations = require('./organizations');
var OnlineResource = require('./onlineResources').OnlineResource;
var hashRecordId = require('../../parsers/record/supportedTypes/MD_Metadata').hashRecordId;

var Record = mongoose.model('Record');
var RelatedResource = mongoose.model('RelatedResource');


module.exports = function(job, done) {
    var hashedId = job.data.hashedId;
    var catalogId = job.data.catalogId;
    var record;
    var alternateResources = [];

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
            var relatedResource;

            try {
                resource = new OnlineResource(rawOnlineResource);
            } catch (err) {
                // console.trace(err);
                // console.error(rawOnlineResource);
                return done();
            }

            if (resource.isWfsFeatureType()) {
                relatedResource = {
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

            if (resource.isWmsLayer()) {
                // Do nothing
                return done();
            }

            relatedResource = {
                record: record.hashedId,
                originId: record._id,
                originType: 'gmd:onLine',
                originCatalog: record.parentCatalog,

                name: resource.name,

                remoteResource: {
                    location: resource.getNormalizedString()
                }
            };

            return RelatedResource.upsertRemoteResource(relatedResource, done);

        }, next);
    }

    function processCoupledResources(next) {
        if (record.metadata.type !== 'service') return next();
        if (!_.get(record.metadata, 'coupledResources', []).length) return next();

        var keywords = _.get(record.metadata, 'keywords', []).join('').toLowerCase();
        var serviceType = _.get(record.metadata, 'serviceType', '').toLowerCase();
        var title = _.get(record.metadata, 'title', '').toLowerCase();

        var isWfsService = serviceType === 'download' ||
            _s.include(serviceType, 'wfs') ||
            _s.include(title, 'wfs') ||
            _s.include(keywords, 'wfs') ||
            _s.include(keywords, 'infofeatureaccessservice');

        if (!isWfsService) return next();

        var onlineResources = _.get(record.metadata, 'onlineResources', []);
        var wfsServiceLocation;

        if (!onlineResources.length) {
            debug('No online resources defined for this WFS service metadata');
            return next();
        } else if (onlineResources.length === 1) {
            var onlineResource;
            try {
                onlineResource = new OnlineResource(onlineResources[0]);
                wfsServiceLocation = onlineResource.getNormalizedWfsServiceLocation();
            } catch (err) {
                debug('The only one candidate location are not valid. WFS service metadata rejected.');
                return next();
            }
        } else {
            var candidateResources = _(onlineResources)
                .map(function (candidateOnlineResource) {
                    var onlineResource;
                    try {
                        onlineResource = new OnlineResource(candidateOnlineResource);
                    } catch (err) {
                        debug('%s: not valid online resource location: %s', candidateOnlineResource.link, err.message);
                        return;
                    }
                    if (_s.include(onlineResource.sourceLocation.toLowerCase(), 'wfs') ||
                         _s.include(onlineResource.sourceProtocol.toLowerCase(), 'wfs')) {
                        return onlineResource;
                    }
                })
                .compact()
                .value();

            if (candidateResources.length === 0) {
                debug('No valid location found. WFS service metadata rejected.');
                return next();
            }
            if (candidateResources.length > 1) {
                debug('Too many candidate locations found!!! WFS service metadata rejected.');
                return next();
            }

            wfsServiceLocation = candidateResources[0].getNormalizedWfsServiceLocation();
        }

        debug('process coupled resources');

        async.each(record.metadata.coupledResources || [], function (coupledResource, done) {
            if (!coupledResource.scopedName || !coupledResource.identifier) return done();

            var relatedResource = {
                record: hashRecordId(coupledResource.identifier),
                originId: record._id,
                originType: 'srv:coupledResource',
                originCatalog: record.parentCatalog,

                featureType: {
                    candidateName: coupledResource.scopedName,
                    candidateLocation: wfsServiceLocation
                }
            };

            return RelatedResource.upsertFeatureType(relatedResource, done);
        }, next);
    }

    function finalSave(next) {
        record
            .set('alternateResources', alternateResources)
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
        processCoupledResources,
        removeCheckingRelatedResources,
        finalSave,
        executeTriggers
    ];

    async.series(seq, done);
};
