var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var mongoose = require('./server/mongoose');
var passport = require('./server/passport');
var api = require('./server/api');
// var redis = require('redis');
// var io = require('socket.io');
// var ioRedis = require('socket.io-redis');

var app = express();

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(express.static('app'));
app.use(cookieParser());
app.use(session({ secret: process.env.COOKIE_SECRET, name: 'sid' }));
app.use(passport.initialize());
app.use(passport.session());

app.use(api);

app.get('/auth/datagouv', passport.authenticate('datagouv'));
app.get('/auth/datagouv/callback', passport.authenticate('datagouv', { 
    successRedirect: '/',
    failureRedirect: '/login'
}));

app.get('/', function(req, res) {
    if (!req.user) res.redirect('/auth/datagouv');
    res.render('index');
});

app.listen(process.env.PORT);
