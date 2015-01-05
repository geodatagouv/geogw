/*
** Module dependencies
*/
var async = require('async');
var _ = require('lodash');
var iso19139 = require('iso19139');
var libxml = require('libxmljs');

var mongoose = require('../../mongoose');
var resources = require('./resources');

var CswRecord = mongoose.model('CswRecord');
var Record = mongoose.model('Record');


module.exports = function(job, done) {
    var recordId = job.data.recordId;
    var catalogId = job.data.catalogId;
    var cswRecord, parsedRecord, record;
    var recordName;

    function loadCswRecord(next) {
        CswRecord
            .findOne({ identifier: recordId, parentCatalog: catalogId })
            .select('-availableSince -removedSince -synchronizations')
            .sort('-timestamp')
            .exec(function (err, foundRecord) {
                if (err) return next(err);
                if (!foundRecord) return next(new Error('Record not found'));
                cswRecord = foundRecord;
                next();
            });
    }

    function parseCswRecord(next) {
        var xmlElement;
        try {
            xmlElement = libxml.parseXml(cswRecord.xml, { noblanks: true });
        } catch (ex) {
            return next(ex);
        }
        parsedRecord = iso19139.parse(xmlElement.root());
        recordName = parsedRecord.title || parsedRecord.name;
        next();
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
        loadCswRecord,
        parseCswRecord,
        loadComputedRecord,
        applyChanges,
        processRelatedServices,
        saveComputedRecord
    ];

    async.series(seq, done);
};
