var jobs = require('./server/kue').jobs;
var cswHarvester = require('./server/workers/csw');

jobs.process('harvest', 2, function(job, done) {
    cswHarvester.harvest(job, done);
});

require('kue').app.listen(process.env.PORT || 3000);
