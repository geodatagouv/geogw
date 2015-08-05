/*
** Module dependencies
*/
var path = require('path');
var mongoose = require('mongoose');
var utils = require('./utils');
var Promise = require('bluebird');

mongoose.Promise = Promise;

mongoose.connect(process.env.MONGODB_URL);

utils.walk(path.join(__dirname, 'models'), null, function(path) {
    require(path);
});

module.exports = mongoose;
