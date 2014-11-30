/*
** Module dependencies
*/
var _ = require('lodash');
var util = require('util');
var es = require('event-stream');
var csw = require('csw-client');
var iso19139 = require('iso19139');
var mongoose = require('../../mongoose');
var Record = mongoose.model('Record');
var moment = require('moment');
var async = require('async');
var resources = require('./resources');
var ServiceSyncJob = require('../syncJob');


/*
** Constructor
*/
function CswHarvestJob(job) {
    ServiceSyncJob.call(this, job);
}

util.inherits(CswHarvestJob, ServiceSyncJob);


/*
** Methods
*/
CswHarvestJob.prototype.createCswHarvester = function() {
    var location = this.service.location;

    var client = csw(location, {
        maxSockets: this.data.maxSockets || 5,
        keepAlive: true,
        retry: this.data.maxRetry || 3,
        userAgent: 'Afigeo CSW harvester',
        queryStringToAppend: this.service.locationOptions.query,
        concurrency: 5
    });

    var harvesterOptions = {
        typeNames: 'gmd:MD_Metadata',
        outputSchema: 'http://www.isotc211.org/2005/gmd',
        elementSetName: 'full',
        constraintLanguage: 'CQL_TEXT'
    };

    if (location.indexOf('isogeo') !== -1) harvesterOptions.namespace = 'xmlns(gmd=http://www.isotc211.org/2005/gmd)';
    if (location.indexOf('geoportal/csw/discovery') !== -1) delete harvesterOptions.constraintLanguage;

    return client.harvest(harvesterOptions);
};


/*
** Sync method
*/
CswHarvestJob.prototype._sync = function() {
    var service = this.service;
    var job = this;

    function updateRecord(record, rawRecord, done) {
        var metadata = _.pick(rawRecord, [
            'title',
            'abstract',
            'type',
            'representationType',
            'serviceType',
            'keywords',
            'contacts',
            '_contacts',
            '_updated'
        ]);

        var processItem = function(onlineResource, done) {
            resources.all(record, onlineResource, done);
        };

        async.map(rawRecord.onlineResources || [], processItem, function(err, onlineResources) {
            if (err) return done(err);

            metadata.onlineResources = _.compact(onlineResources);

            record.set('metadata', metadata);
            record.set('lastSync', job.id);

            record.save(done);
        });
    }

    function createNewRecord(rawRecord, done) {
        var record = new Record({ identifier: rawRecord.fileIdentifier, parentCatalog: service._id });
        updateRecord(record, rawRecord, done);
    }

    function processRecord(rawRecord, done) {
        if (!rawRecord.fileIdentifier) {
            job.log('Dropping 1 record: no fileIdentifier set!');
            return done();
        }

        var name = rawRecord.title || rawRecord.name || rawRecord.fileIdentifier;
        // debug('processing record %s', name);

        // Convert input date
        if (rawRecord._updated) rawRecord._updated = moment(rawRecord._updated).toDate();

        Record
            .findOne({ identifier: rawRecord.fileIdentifier, parentCatalog: service._id })
            .exec(function(err, record) {
                if (err) return done(err);

                if (!record) {
                    job.log('New record ' + name);
                    createNewRecord(rawRecord, done);
                } else {
                    if (!rawRecord._updated && record.metadata._updated) {
                        job.log('Dropping 1 record: no more _updated attribute!');
                        done();
                    } else if (rawRecord._updated && moment(record.metadata._updated).isSame(rawRecord._updated)) {
                        job.log('Record ' + name + ': not updated');
                        // record.set('lastSync', serviceSync._id).save(done);
                        updateRecord(record, rawRecord, done);
                    } else if (rawRecord._updated && moment(record.metadata._updated).isAfter(rawRecord._updated)) {
                        job.log('Record ' + name + ': older version found!!!');
                        done();
                    } else {
                        job.log('Record ' + name + ': new version found!');
                        updateRecord(record, rawRecord, done);
                    }
                }
            });
    }

    var harvester = this.createCswHarvester();

    harvester.on('error', function(err) {
        job.log(JSON.stringify(err));
        console.trace(err);
    });

    harvester.on('started', function() {
        job.log('Records matched: %d', this.matched);
    });

    var q = async.queue(function (record, done) {
        processRecord(record, done);
    }, 1);

    var recordTypeStats = {};

    function recordTypeCount(xmlRecord) {
        if (!(xmlRecord.name() in recordTypeStats)) {
            recordTypeStats[xmlRecord.name()] = 1;
        } else {
            recordTypeStats[xmlRecord.name()]++;
        }

        return xmlRecord;
    }

    harvester
        .pipe(es.mapSync(recordTypeCount))
        .pipe(iso19139.parseAll())
        .on('data', function(record) {
            job.progress(harvester.returned, harvester.matched);
            q.push(record);
        })
        .on('end', function() {
            job.log('Records returned: %d', this.returned);
            job.log('Statistics by record type:');
            _(recordTypeStats).forEach(function(count, recordType) {
                job.log('* %s: %d', recordType, count);
            });
            job.success(this.returned);
        });

};


/*
** Exports
*/
exports.harvest = function(job, done) {
    (new CswHarvestJob(job)).start(done);
};
