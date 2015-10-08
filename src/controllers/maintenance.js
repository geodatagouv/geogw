import sidekick from '../helpers/sidekick';
import through2 from 'through2';
import mongoose from 'mongoose';

const RecordRevision = mongoose.model('RecordRevision');
const ConsolidatedRecord = mongoose.model('ConsolidatedRecord');
const RemoteResource = mongoose.model('RemoteResource');


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

export function checkAllRemoteResources(req, res) {
    let count = 0;
    RemoteResource.find().select('_id location').lean().stream()
        .pipe(through2.obj((remoteResource, enc, cb) => {
            return RemoteResource.triggerCheck(remoteResource)
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
            res.send({ task: 'check-all-remote-resources', status: 'ok', count });
        });
}
