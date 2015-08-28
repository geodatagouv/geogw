import forEachInCollection from 'lodash/collection/forEach';
import through2  from 'through2';
import { inspect } from 'util';
import csw from 'csw-client';
import mongoose from '../../mongoose';
import ServiceSyncJob from '../syncJob';
import { parse as parseRecord } from '../../parsers/record';


const RecordRevision = mongoose.model('Record');


class CswHarvestJob extends ServiceSyncJob {

    constructor(job, options) {
        super(job, options);
    }


    createCswHarvester() {
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

        if (location.includes('isogeo')) harvesterOptions.namespace = 'xmlns(gmd=http://www.isotc211.org/2005/gmd)';
        if (location.includes('geoportal/csw/discovery')) delete harvesterOptions.constraintLanguage;
        if (location.includes('tigeo')) delete harvesterOptions.constraintLanguage;

        return client.harvest(harvesterOptions);
    }

    stats() {
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
    }

    globalProgress() {
        this.returned = 0;
        var job = this;

        return through2.obj(function (record, enc, cb) {
            job.returned++;
            job.progress(job.returned, job.matched);
            cb(null, record);
        });
    }

    processRecord() {
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

            RecordRevision.upsert(record)
                .then(upsertStatus => ({ parseResult: parseResult, upsertStatus: upsertStatus }))
                .nodeify(done);
        });
    }

    _sync() {
        var job = this;
        var harvester = this.harvester = this.createCswHarvester();

        harvester.on('error', function(err) {
            job.log(inspect(err));
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
                forEachInCollection(job.recordTypeStats, function(count, recordType) {
                    job.log('* %s: %d', recordType, count);
                });
                job.log('Statistics by record status:');
                forEachInCollection(job.recordStatusStats, function(count, recordStatus) {
                    job.log('* %s: %d', recordStatus, count);
                });
                job.success(harvester.returned);
            })
            .resume();
    }

    _finish() {
        if (this.harvester) {
            this.harvester.pause();
            this.harvester.unpipe();
            this.harvester.removeAllListeners();
            this.harvester = null;
        }
    }

}

export function harvest(job, done) {
    (new CswHarvestJob(job, { failsAfter: 600 })).start(done);
}
