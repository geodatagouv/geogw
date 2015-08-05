/*
** Module dependencies
*/
var _ = require('lodash');
var through2 = require('through2');
var s = require('underscore.string');
var util = require('util');
var csw = require('csw-client');

var mongoose = require('../../mongoose');
var ServiceSyncJob = require('../syncJob');
var parseRecord = require('../../parsers/record').parse;

var Record = mongoose.model('Record');


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

    location.replace('metadata.carmencarto.fr/geosource-', 'metadata.carmencarto.fr/geosource/');

    var client = csw(location, {
        // Removed since redirections may break agent definition (example: http > https)
        // maxSockets: this.data.maxSockets || 5,
        // keepAlive: true,
        retry: this.data.maxRetry || 3,
        userAgent: 'Afigeo CSW harvester',
        concurrency: 5,
        noEncodeQs: location.indexOf('metadata.carmencarto.fr') !== -1
    });

    var harvesterOptions = {
        typeNames: 'gmd:MD_Metadata',
        outputSchema: 'http://www.isotc211.org/2005/gmd',
        elementSetName: 'full',
        constraintLanguage: 'CQL_TEXT'
    };

    if (location.indexOf('isogeo') !== -1) harvesterOptions.namespace = 'xmlns(gmd=http://www.isotc211.org/2005/gmd)';
    if (location.indexOf('geoportal/csw/discovery') !== -1) delete harvesterOptions.constraintLanguage;
    if (s.include(location, 'tigeo')) delete harvesterOptions.constraintLanguage;

    return client.harvest(harvesterOptions);
};

CswHarvestJob.prototype.stats = function () {
    var recordTypeStats = this.recordTypeStats = {};
    var recordStatusStats = this.recordStatusStats = {};

    return through2.obj(function (processResult, enc, cb) {
        var parseResult = processResult.parseResult;
        var recordType = parseResult.recordType;
        var processStatus = parseResult.valid ? processResult.upsertStatus : 'not-valid';

        if (!(recordType in recordTypeStats)) {
            recordTypeStats[recordType] = 1;
        } else {
            recordTypeStats[recordType]++;
        }

        if (!(processStatus in recordStatusStats)) {
            recordStatusStats[processStatus] = 1;
        } else {
            recordStatusStats[processStatus]++;
        }

        cb(null, processResult);
    });
};

CswHarvestJob.prototype.globalProgress = function () {
    this.returned = 0;
    var job = this;

    return through2.obj(function (record, enc, cb) {
        job.returned++;
        job.progress(job.returned, job.matched);
        cb(null, record);
    });
};

CswHarvestJob.prototype.processRecord = function () {
    var job = this;

    return through2.obj(function (xmlElement, enc, done) {
        var parseResult = parseRecord(xmlElement);

        if (!parseResult.parsedRecord || !parseResult.valid) {
            return done(null, { parseResult: parseResult });
        }

        var record = {
            parentCatalog: job.service._id,
            hashedId: parseResult.hashedId,
            hashedRecord: parseResult.hashedRecord,
            dateStamp: parseResult.updatedAt,
            metadata: parseResult.parsedRecord,
            identifier: parseResult.id
        };

        Record.upsert(record, function (err, upsertStatus) {
            if (err) return done(err);
            done(null, { parseResult: parseResult, upsertStatus: upsertStatus });
        });
    });
};


/*
** Sync method
*/
CswHarvestJob.prototype._sync = function() {
    var job = this;
    var harvester = this.harvester = this.createCswHarvester();

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
            _.forEach(job.recordTypeStats, function(count, recordType) {
                job.log('* %s: %d', recordType, count);
            });
            job.log('Statistics by record status:');
            _.forEach(job.recordStatusStats, function(count, recordStatus) {
                job.log('* %s: %d', recordStatus, count);
            });
            job.success(harvester.returned);
        })
        .resume();
};

CswHarvestJob.prototype._finish = function () {
    if (this.harvester) {
        this.harvester.pause();
        this.harvester.unpipe();
        this.harvester.removeAllListeners();
        this.harvester = null;
    }
};


/*
** Exports
*/
exports.harvest = function(job, done) {
    (new CswHarvestJob(job, { failsAfter: 600 })).start(done);
};
