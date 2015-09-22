require('babel/polyfill');
require('./lib/mongoose');
require('./lib/passport');
require('./lib/kue');

module.exports = require('./lib/express');
