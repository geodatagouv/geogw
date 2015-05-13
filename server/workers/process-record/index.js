/*
** Module dependencies
*/
var crypto = require('crypto');

var async = require('async');
var _ = require('lodash');
var debug = require('debug')('process-record');

var mongoose = require('../../mongoose');
var organizations = require('./organizations');
var facets = require('./facets');
var OnlineResource = require('./onlineResources').OnlineResource;
var relatedResources = require('./relatedResources');
var featureTypeMatchings = require('../../matching/featureTypes');

var CswRecord = mongoose.model('CswRecord');
var Record = mongoose.model('Record');


module.exports = function(job, done) {
    var recordId = job.data.recordId;
    var catalogId = job.data.catalogId;
    var parsedRecord, record, mostRecentCswRecord;
    var recordName;

    function loadMostRecentCswRecord(next) {
        debug('load most recent CSW record');
        CswRecord
            .findOne({ identifier: recordId, parentCatalog: catalogId })
            .select({ timestamp: 1, parsed: 1 })
            .sort({ timestamp: -1 })
            .exec(function (err, mostRecentFound) {
                if (err) return next(err);
                if (!mostRecentFound) return next(new Error('Record not found'));
                mostRecentCswRecord = mostRecentFound;
                next();
            });
    }

    function loadComputedRecord(next) {
        debug('load computed record');

        var query = { identifier: recordId, parentCatalog: catalogId };

        Record
            .findOne(query)
            .exec(function (err, foundRecord) {
                if (err) return next(err);
                record = foundRecord || new Record(query);
                next();
            });
    }

    function loadParsedRecord(next) {
        debug('load CSW-related parsed record');

        var query = CswRecord.findById(mostRecentCswRecord._id);

        // Check if the record has already been parsed
        if (mostRecentCswRecord.parsed === true) {
            query.select({ parsedValue: 1 });
        } else {
            query.select({ xml: 1 });
        }

        query.exec(function (err, cswRecord) {
            if (err) return next(err);
            if (!cswRecord) return next(new Error('CswRecord not found'));

            function parsedValueReady(parsedValue) {
                parsedRecord = parsedValue;
                recordName = parsedRecord.title || parsedRecord.name;
                next();
            }

            if (cswRecord.parsedValue) {
                debug('Already parsed!');
                parsedValueReady(cswRecord.parsedValue);
            } else {
                debug('Not parsed again :(');
                cswRecord.parseXml(function (err, parsedValue) {
                    if (err) return next(err);

                    cswRecord.save(function (err) {
                        if (err) console.trace(err);
                    });

                    parsedValueReady(parsedValue);
                });
            }
        });
    }

    function applyChanges(next) {
        debug('apply changes');

        debug('Parsed record: ');
        debug(parsedRecord);

        var metadata = _.pick(parsedRecord, [
            'title',
            'abstract',
            'type',
            'representationType',
            'serviceType',
            'lineage',
            'keywords',
            'contacts',
            'onlineResources',
            'graphicOverviews',
            'history',
            '_contacts',
            '_updated'
        ]);
        record.set('metadata', metadata);

        record.set('sourceRecord', mostRecentCswRecord._id);

        // Process representationType
        if (parsedRecord.representationType === 'raster') {
            // TODO: Warn catalog owner
            record.representationType = 'grid';
        }

        // Process organizations
        function normalizeOrganization(contact) {
            var originalName = contact.organizationName;
            if (!originalName) return;
            if (!organizations[originalName]) return originalName;
            if (organizations[originalName].reject) return; // TODO: Warn catalog owner
            if (organizations[originalName].rename) return organizations[originalName].rename;
        }

        var normalizedOrganizations = _.chain([parsedRecord.contacts, parsedRecord._contacts])
            .flatten()
            .compact()
            .map(normalizeOrganization)
            .compact()
            .uniq()
            .valueOf();

        record.set('organizations', normalizedOrganizations);

        // Compute hashedId
        record.set('hashedId', crypto.createHash('sha1').update(recordId, 'utf8').digest('hex'));

        next();
    }

    function deleteExistingRelatedResources(next) {
        relatedResources.deleteExisting(record, next);
    }

    function processOnlineResources(next) {
        debug('process online resources');

        if (parsedRecord.type === 'service') return next();
        if (!parsedRecord.onlineResources) return next();

        async.each(parsedRecord.onlineResources, function (rawOnlineResource, done) {
            var resource;

            try {
                resource = new OnlineResource(rawOnlineResource);
            } catch (err) {
                // console.trace(err);
                // console.error(rawOnlineResource);
                return done();
            }

            if (resource.isWfsFeatureType()) {
                var featureType = {
                    location: resource.getNormalizedWfsServiceLocation(),
                    name: resource.getFeatureTypeName()
                };

                var relatedResource;

                var insert = function (cb) {
                    relatedResources.insertFeatureType(record, featureType, function (err, documentInserted) {
                        if (err) return cb(err);
                        relatedResource = documentInserted;
                        cb();
                    });
                };

                var resolve = function (cb) {
                    featureTypeMatchings.resolveByRelatedResource(relatedResource, cb);
                };

                return async.series([insert, resolve], done);
            }

            if (resource.isWellKnownService()) {
                // Do nothing
                return done();
            }

            // Else
            return done();

        }, next);
    }

    function computeFacets(next) {
        debug('compute facets');
        facets.compute(record);
        next();
    }

    function saveComputedRecord(next) {
        debug('final save');
        record.save(next);
    }

    var seq = [
        loadMostRecentCswRecord,
        loadComputedRecord,
        loadParsedRecord,
        applyChanges,
        deleteExistingRelatedResources,
        processOnlineResources,
        computeFacets,
        saveComputedRecord
    ];

    async.series(seq, done);
};
