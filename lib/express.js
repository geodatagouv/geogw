const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const kue = require('kue');
const session = require('express-session');
const { json } = require('body-parser');
const parseJson = json;
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const sessionMongo = require('connect-mongo');
const { walk } = require('./utils');

const MongoStore = sessionMongo(session);

class Server {

    constructor() {
        this.app = express();
    }

    // private
    mountTopMiddlewares() {
        this.app.use(cors());
        this.app.use(parseJson());
        this.app.use(cookieParser());
    }

    // private
    mountSessionMiddleware() {
        this.app.use(session({
            secret: process.env.COOKIE_SECRET,
            name: 'sid',
            saveUninitialized: false,
            resave: false,
            store: new MongoStore({
                mongooseConnection: mongoose.connection
            })
        }));
    }

    // private
    mountAuth() {
        // Middlewares
        this.app.use(passport.initialize());
        this.app.use(passport.session());

        // Login route
        this.app.get('/login', passport.authenticate('data.gouv.fr', { scope: 'default' }));

        // OAuth callback
        this.app.get('/dgv/oauth/callback', function (req, res) {
            passport.authenticate('data.gouv.fr', {
                successRedirect: '/account/organizations',
                failureRedirect: '/'
            })(req, res);
        });

        // Logout route
        this.app.get('/logout', (req, res) => {
            req.logout();
            res.redirect('/');
        });
    }

    // private
    mountRoutes() {
        this.geogwRouter = new express.Router();
        walk(path.join(__dirname, 'routes'), 'middlewares', path => require(path)(this.geogwRouter));
        this.app.use('/api/geogw', this.geogwRouter);
        require('./dgfr/routes')(this.app);
        this.app.use('/kue', kue.app);
    }

    getHandler() {
        if (this.handlerReady) return this.app;

        this.mountTopMiddlewares();
        this.mountSessionMiddleware();
        this.mountAuth();
        this.mountRoutes();

        this.handlerReady = true;
        return this.app;
    }

}

module.exports = (new Server()).getHandler();
