const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const sessionMongo = require('connect-mongo');
const httpProxy = require('http-proxy');
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

    /* udata proxy */

    const udataProxy = httpProxy.createProxyServer({});

    udataProxy.on('proxyReq', (proxyReq, req) => {
      if (req.user) {
        proxyReq.setHeader('Authorization', 'Bearer ' + req.user.accessToken);
      }
    });

    app.use('/proxy-api', (req, res) => udataProxy.web(req, res, {
      changeOrigin: true,
      target: process.env.DATAGOUV_URL + '/api'
    }));

    app.use('/api', require('./routes/producers')());
    app.use('/api', require('./routes/organizations')());
    app.use('/api', require('./routes/datasets')());

    app.get('/api/me', ensureLoggedIn, function (req, res) {
      res.send(omit(req.user, 'accessToken'));
    });

    return app;
};
