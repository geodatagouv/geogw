var jobs = require('../server/kue').jobs;
var mongoose = require('../server/mongoose');

var Record = mongoose.model('Record');

var count = 0;

Record
    .find()
    .select({ identifier: 1, parentCatalog: 1 })
    .lean()
    .stream()
    .on('data', function (record) {
        count++;
        jobs
            .create('process-record', {
                recordId: record.identifier,
                catalogId: record.parentCatalog
            })
            .removeOnComplete(true)
            .attempts(5)
            .save();
    })
    .on('error', function (err) {
        console.trace(err);
    })
    .on('close', function () {
        console.log(count);
        process.exit();
    });
