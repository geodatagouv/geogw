var express = require('express');
var bodyParser = require('body-parser');
var passport = require('./passport');
var utils = require('./utils');

var app = express();

app.use(bodyParser());

utils.walk(__dirname + '/routes', 'middlewares', function(path) {
    require(path)(app, passport);
});

module.exports = app;
