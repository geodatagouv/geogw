/* eslint no-console: off */
require('./lib/kue');
const kueApp = require('kue').app;
const port = process.env.PORT || 3030;

kueApp.listen(port);
console.log(`Kue App is listening on port ${port}`);
