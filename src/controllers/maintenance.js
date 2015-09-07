import sidekick from '../helpers/sidekick';
import through2 from 'through2';
import mongoose from 'mongoose';

const RecordRevision = mongoose.model('RecordRevision');


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
        .on('end', () => {
            res.send({ task: 'process-all-records', status: 'ok', count });
        });
}
