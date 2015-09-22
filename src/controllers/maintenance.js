import sidekick from '../helpers/sidekick';
import through2 from 'through2';
import mongoose from 'mongoose';

const RecordRevision = mongoose.model('RecordRevision');
const ConsolidatedRecord = mongoose.model('ConsolidatedRecord');


export function processAllRecords(req, res) {
    let count = 0;
    RecordRevision.find().select('recordId recordHash').lean().stream()
        .pipe(through2.obj((recordRevision, enc, cb) => {
            return sidekick('process-record', recordRevision)
                .then(() => {
                    count++;
                    cb();
                })
                .catch(err => {
                    console.error(err);
                    cb(err);
                });
        }))
        .on('finish', () => {
            res.send({ task: 'process-all-records', status: 'ok', count });
        });
}

export function consolidateAllRecords(req, res) {
    let count = 0;
    ConsolidatedRecord.find().select('recordId').lean().stream()
        .pipe(through2.obj((record, enc, cb) => {
            return sidekick('dataset:consolidate', { recordId: record.recordId })
                .then(() => {
                    count++;
                    cb();
                })
                .catch(err => {
                    console.error(err);
                    cb(err);
                });
        }))
        .on('finish', () => {
            res.send({ task: 'consolidate-all-records', status: 'ok', count });
        });
}
