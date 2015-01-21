var es = require('event-stream');

var jobs = require('../server/kue').jobs;
var mongoose = require('../server/mongoose');

var Record = mongoose.model('Record');

Record
    .find()
    .select({ identifier: 1, parentCatalog: 1 })
    .lean()
    .stream()
    .pipe(es.map(function (record, cb) {
        jobs
            .create('process-record', {
                recordId: record.identifier,
                catalogId: record.parentCatalog
            })
            .removeOnComplete(true)
            .attempts(5)
            .save(cb);
    }))
    .on('error', function (err) {
        console.trace(err);
    })
    .on('end', function () {
        console.log('Completed');
        process.exit();
    });
