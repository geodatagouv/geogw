var _ = require('lodash');

var q = require('./lib/kue').jobs;
var csw = require('./lib/tasks/harvest-csw');
var wfs = require('./lib/tasks/lookup-wfs');
var processRecord = require('./lib/tasks/process-record');
var consolidateDataset = require('./lib/tasks/consolidate-dataset');

// To remove in the future
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('ssl-root-cas/latest').inject();

q.process('harvest-csw', 4, csw.harvest);
q.process('lookup-wfs', 10, wfs.lookup);
q.process('process-record', 20, processRecord);
q.process('dataset:consolidate', 20, consolidateDataset);

require('kue').app.listen(process.env.PORT || 3000);

var gracefulShutdown = _.once(function () {
    q.shutdown(function (err) {
        console.log( 'Job queue is shut down. ', err || '');
        process.exit(0);
    }, 5000);
});

process.on('message', function (msg) {
    if (msg === 'shutdown') {
        gracefulShutdown();
    }
});

process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', function (err) {
    console.log('Uncaught exception!!');
    console.trace(err);
    gracefulShutdown();
});
