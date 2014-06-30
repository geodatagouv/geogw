var jobs = require('./server/kue').jobs;
var csw = require('./server/workers/csw');

require('ssl-root-cas/latest').inject();

jobs.process('service-sync', 2, function(job, done) {
    if (job.data.protocol === 'csw') csw.harvest(job, done);
    else done(new Error('Unknown protocol'));
});

require('kue').app.listen(process.env.PORT || 3000);
