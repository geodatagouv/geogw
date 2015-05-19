/*
** Module dependencies
*/
var mongoose = require('mongoose');
var utils = require('./utils');

mongoose.connect(process.env.MONGODB_URL);

utils.walk(__dirname + '/models', null, function(path) {
    require(path);
});

module.exports = mongoose;
