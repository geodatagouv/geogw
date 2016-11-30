const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const sessionMongo = require('connect-mongo');
const { omit } = require('lodash');
const { ensureLoggedIn } = require('./middlewares');

require('./models');
require('./passport');

const MongoStore = sessionMongo(session);

module.exports = function () {

    const app = express();

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

    function extractRedirectUrl(req, res, next) {
        req.session.redirectTo = req.query.redirect;
        next();
    }

    app.get('/login', extractRedirectUrl, passport.authenticate('udata', { scope: 'default' }));

    app.get('/logout', extractRedirectUrl, (req, res) => {
        req.logout();
        res.redirect(req.session.redirectTo);
        req.session.redirectTo = undefined;
    });

    app.get('/oauth/callback', function (req, res) {
        passport.authenticate('udata', {
            successRedirect: req.session.redirectTo,
            failureRedirect: '/'
        })(req, res);
        req.session.redirectTo = undefined;
    });

    app.get('/api/me', ensureLoggedIn, function (req, res) {
      res.send(omit(req.user, 'accessToken'));
    });

    require('./routes/organizations')(app);
    require('./routes/producers')(app);
    require('./routes/datasets')(app);

    return app;
};
