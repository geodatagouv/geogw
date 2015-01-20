/*
** Module dependencies
*/
var async = require('async');
var _ = require('lodash');

var mongoose = require('../../mongoose');
var resources = require('./resources');
var organizations = require('./organizations');

var CswRecord = mongoose.model('CswRecord');
var Record = mongoose.model('Record');


module.exports = function(job, done) {
    var recordId = job.data.recordId;
    var catalogId = job.data.catalogId;
    var parsedRecord, record, mostRecentCswRecord;
    var recordName;

    function loadMostRecentCswRecord(next) {
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
                parsedValueReady(cswRecord.parsedValue);
            } else {
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
        var metadata = _.pick(parsedRecord, [
            'title',
            'abstract',
            'type',
            'representationType',
            'serviceType',
            'keywords',
            'contacts',
            'onlineResources',
            '_contacts',
            '_updated'
        ]);
        record.set('metadata', metadata);

        record.set('sourceRecord', mostRecentCswRecord._id);

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

        next();
    }

    function processRelatedServices(next) {
        if (parsedRecord.type === 'service') return next();
        if (!parsedRecord.onlineResources) return next();

        async.each(parsedRecord.onlineResources, function (resource, done) {
            resources.all(record, resource, done);
        }, next);
    }

    function saveComputedRecord(next) {
        record.save(next);
    }

    var seq = [
        loadMostRecentCswRecord,
        loadComputedRecord,
        loadParsedRecord,
        applyChanges,
        processRelatedServices,
        saveComputedRecord
    ];

    async.series(seq, done);
};
