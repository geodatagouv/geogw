'use strict';

const { once } = require('lodash');
require('./lib/mongoose');
const pluginJobs = require('./plugins/publish-to-udata/jobs');

var q = require('./lib/kue').jobs;
var csw = require('./lib/tasks/harvest-csw');
var wfs = require('./lib/tasks/lookup-wfs');
var processRecord = require('./lib/tasks/process-record').exec;
var consolidateDataset = require('./lib/tasks/consolidate-dataset').exec;

// To remove in the future
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('ssl-root-cas/latest').inject();

q.process('harvest-csw', 2, csw.harvest);
q.process('lookup-wfs', 5, wfs.lookup);
q.process('process-record', 5, processRecord);
q.process('dataset:consolidate', 5, consolidateDataset);

q.process('udata:synchronizeOne', 5, pluginJobs.synchronizeOne);
q.process('udata:synchronizeAll', 1, pluginJobs.synchronizeAll);

var gracefulShutdown = once(function () {
    q.shutdown(5000, function (err) {
        console.log('Job queue is shut down. ', err || '');
        process.exit();
    });
});

process.on('message', function (msg) {
    if (msg === 'shutdown') {
        gracefulShutdown();
    }
});

process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', function (err) {
    console.log('Uncaught exception!!');
    console.log(err);
    gracefulShutdown();
});
