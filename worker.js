var jobs = require('./server/kue').jobs;
var csw = require('./server/workers/harvest-csw');
var wfs = require('./server/workers/lookup-wfs');
var processRecord = require('./server/workers/process-record');

require('ssl-root-cas/latest').inject();

jobs.process('harvest-csw', 2, csw.harvest);
jobs.process('lookup-wfs', 10, wfs.lookup);
jobs.process('process-record', 20, processRecord);

require('kue').app.listen(process.env.PORT || 3000);
