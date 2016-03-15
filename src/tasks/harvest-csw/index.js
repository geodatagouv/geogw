import through2 from 'through2';
import { inspect } from 'util';
import mongoose from '../../mongoose';
import ServiceSyncJob from '../syncJob';
const Harvester = require('../../helpers/CSWHarvester').Harvester;

const RecordRevision = mongoose.model('RecordRevision');
const CatalogRecord = mongoose.model('CatalogRecord');


class CswHarvestJob extends ServiceSyncJob {

    constructor(job, options) {
        super(job, options);
    }

    processRecord() {
        return through2.obj((record, enc, done) => {
            this.returned++;
            if (this.harvester.allStarted) this.progress(this.returned, this.harvester.matched);

            const catalogRecordRevision = {
                catalog: this.service,
                recordId: record.hashedId,
                recordHash: record.hash,
                recordType: record.type,
                revisionDate: record.modified,
                content: record.body
            };

            RecordRevision.upsert(catalogRecordRevision)
                .then(() => CatalogRecord.upsert(catalogRecordRevision))
                .nodeify(done);
        });
    }

    _sync() {
        this.returned = 0;

        const location = this.service.location;
        location.replace('metadata.carmencarto.fr/geosource-', 'metadata.carmencarto.fr/geosource/');

        const harvesterOptions = {
            encodeQs: !location.includes('metadata.carmencarto.fr'),
            forceConstraintLanguage: true,
            dublinCoreFallback: location.includes('grandlyon') || location.includes('adour-garonne.eaufrance.fr')
        };
        if (location.includes('isogeo')) harvesterOptions.defineNamespace = true;
        if (location.includes('geoportal/csw/discovery') || location.includes('tigeo') || location.includes('bdt.gers')) {
            harvesterOptions.forceConstraintLanguage = false;
        }

        this.harvester = new Harvester(location, harvesterOptions);

        this.harvester
            .on('error', err => this.log(inspect(err)))
            .once('all-failed', () => this.fail(new Error('Harvesting has failed')))
            .once('started', () => this.log('Records matched: %d', this.harvester.matched))
            .on('ignore', () => this.returned++)
            .pipe(this.processRecord())
                .on('end', () => {
                    this.log('Records returned: %d', this.harvester.returned);
                    this.success(this.harvester.returned);
                })
            .resume();
    }

    _finish() {
        if (this.harvester) {
            this.harvester.unpipe();
            this.harvester.removeAllListeners();
            this.harvester = null;
        }
    }

}

export function harvest(job, done) {
    (new CswHarvestJob(job, { failsAfter: 600 })).start(done);
}
