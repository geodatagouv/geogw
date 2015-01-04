var jobs = require('./server/kue').jobs;
var csw = require('./server/workers/harvest-csw');
var wfs = require('./server/workers/wfs');
var processRecord = require('./server/workers/process-record');

require('ssl-root-cas/latest').inject();

jobs.process('service-sync', 2, function(job, done) {
    if (job.data.protocol === 'csw') csw.harvest(job, done);
    else if (job.data.protocol === 'wfs') wfs.lookup(job, done);
    else done(new Error('Unknown protocol'));
});

jobs.process('process-record', 100, processRecord);

require('kue').app.listen(process.env.PORT || 3000);
