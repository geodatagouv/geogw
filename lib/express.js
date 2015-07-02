var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var mongoose = require('mongoose');
var passport = require('passport');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var cors = require('cors');

var utils = require('./utils');

// Configure passport
require('./passport');

var app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

app.use(session({
    secret: process.env.COOKIE_SECRET,
    name: 'sid',
    saveUninitialized: false,
    resave: false,
    store: new MongoStore({
        mongooseConnection: mongoose.connection
    })
}));

app.use(passport.initialize());
app.use(passport.session());

/* Passport */

app.get('/login', passport.authenticate('data.gouv.fr', { scope: 'default' }));

app.get('/dgv/oauth/callback', function (req, res) {
    passport.authenticate('data.gouv.fr', {
        successRedirect: '/account/organizations',
        failureRedirect: '/'
    })(req, res);
});

app.get('/logout', function (req, res){
  req.logout();
  res.redirect('/');
});

/* API */
var geogwRouter = new express.Router();
utils.walk(__dirname + '/routes', 'middlewares', function(path) {
    require(path)(geogwRouter);
});
app.use('/api/geogw', geogwRouter);
require('./dgfr/routes')(app);

module.exports = app;
