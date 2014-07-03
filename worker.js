var jobs = require('./server/kue').jobs;
var csw = require('./server/workers/csw');
var wfs = require('./server/workers/wfs');

require('ssl-root-cas/latest').inject();

jobs.process('service-sync', 2, function(job, done) {
    if (job.data.protocol === 'csw') csw.harvest(job, done);
    else if (job.data.protocol === 'wfs') wfs.lookup(job, done);
    else done(new Error('Unknown protocol'));
});

require('kue').app.listen(process.env.PORT || 3000);
