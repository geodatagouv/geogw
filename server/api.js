var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var passport = require('./passport');
var utils = require('./utils');

var app = express();

app.use(cors());
app.use(bodyParser.json());

utils.walk(__dirname + '/routes', 'middlewares', function(path) {
    require(path)(app, passport);
});

module.exports = app;
