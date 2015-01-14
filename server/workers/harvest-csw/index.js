/*
** Module dependencies
*/
var _ = require('lodash');
var util = require('util');
var es = require('event-stream');
var csw = require('csw-client');

var ServiceSyncJob = require('../syncJob');
var CswRecord = require('./record');


/*
** Constructor
*/
function CswHarvestJob(job, options) {
    ServiceSyncJob.call(this, job, options);
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

CswHarvestJob.prototype.stats = function () {
    var recordTypeStats = this.recordTypeStats = {};
    var recordStatusStats = this.recordStatusStats = {};

    return es.mapSync(function (record) {
        if (!(record.recordName in recordTypeStats)) {
            recordTypeStats[record.recordName] = 1;
        } else {
            recordTypeStats[record.recordName]++;
        }

        if (!(record.status in recordStatusStats)) {
            recordStatusStats[record.status] = 1;
        } else {
            recordStatusStats[record.status]++;
        }

        return record;
    });
};

CswHarvestJob.prototype.globalProgress = function () {
    this.returned = 0;
    var job = this;

    return es.mapSync(function (record) {
        job.returned++;
        job.progress(job.returned, job.matched);
        return record;
    });
};

CswHarvestJob.prototype.processRecord = function () {
    var job = this;

    return es.map(function (xmlElement, done) {
        var record = new CswRecord(xmlElement, job);
        record.process(function (err) {
            if (err) return done(err);
            done(null, record);
        });
    });
};


/*
** Sync method
*/
CswHarvestJob.prototype._sync = function() {
    var job = this;

    var harvester = this.createCswHarvester();

    harvester.on('error', function(err) {
        job.log(util.inspect(err));
    });

    harvester.on('failed', function () {
        job.fail(new Error('Harvesting has failed'));
    });

    harvester.on('started', function() {
        job.matched = this.matched;
        job.log('Records matched: %d', this.matched);
    });

    harvester
        .pipe(this.processRecord())
        .pipe(this.stats())
        .pipe(this.globalProgress())
        .on('end', function () {
            job.log('Records returned: %d', harvester.returned);
            job.log('Statistics by record type:');
            _(job.recordTypeStats).forEach(function(count, recordType) {
                job.log('* %s: %d', recordType, count);
            });
            job.log('Statistics by record status:');
            _(job.recordStatusStats).forEach(function(count, recordStatus) {
                job.log('* %s: %d', recordStatus, count);
            });
            job.success(harvester.returned);
        })
        .resume();
};


/*
** Exports
*/
exports.harvest = function(job, done) {
    (new CswHarvestJob(job, { failsAfter: 120 })).start(done);
};
