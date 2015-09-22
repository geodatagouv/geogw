import express from 'express';
import passport from 'passport';
import mongoose from 'mongoose';
import kue from 'kue';
import session from 'express-session';
import { json as parseJson } from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import sessionMongo from 'connect-mongo';
import { walk } from './utils';

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

export default (new Server()).getHandler();
