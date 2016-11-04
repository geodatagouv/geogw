const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const sessionMongo = require('connect-mongo');

require('./models');
require('./passport');

const _ = require('lodash');
const search = require('../../lib/helpers/search');

const organizations = require('./controllers/organizations');
const producers = require('./controllers/producers');
const datasets = require('./controllers/datasets');

const MongoStore = sessionMongo(session);

const Service = mongoose.model('Service');

function ensureLoggedIn(req, res, next) {
    if (!req.user) return res.sendStatus(401);
    next();
}

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

    app.get('/api/me', function (req, res) {
        res.send(req.user);
    });

    app.param('catalogId', function (req, res, next, id) {
        Service.findById(id).exec(function (err, foundService) {
            if (err) return next(err);
            if (!foundService) return res.sendStatus(404);
            if (foundService.protocol !== 'csw') return res.sendStatus(404);
            req.catalog = foundService;
            next();
        });
    });

    app.get('/api/catalogs/:catalogId/producers', function (req, res, next) {
        var query = {
            limit: 1,
            opendata: 'yes',
            availability: 'yes',
            facets: { keyword: 0, opendata: 0, availability: 0, representationType: 0 }
        };

        search(query, req.catalog.name, function (err, result) {
            if (err) return next(err);
            res.send(result.facets.organization || []);
        });
    });

    /* Organizations */

    function ensureUserCanEditOrganization(req, res, next) {
        var organizations = _.pluck(req.user.toObject().organizations, '_id');
        if (organizations.indexOf(req.organization.id) < 0) return res.sendStatus(401);
        next();
    }

    function ensureUserCanCreateOrganization(req, res, next) {
        var organizations = _.pluck(req.user.toObject().organizations, '_id');
        if (organizations.indexOf(req.body._id) < 0) return res.sendStatus(401);
        next();
    }

    app.param('organizationId', organizations.fetch);

    app.route('/api/organizations/:organizationId')
        .get(organizations.show)
        .put(ensureLoggedIn, ensureUserCanEditOrganization, organizations.update, organizations.show);

    app.route('/api/organizations')
        .get(organizations.list)
        .post(ensureLoggedIn, ensureUserCanCreateOrganization, organizations.create, organizations.show);

    /* Producers */

    app.param('producerId', producers.fetch);

    app.route('/api/producers')
        .get(producers.list);

    /* Associations */

    app.route('/api/organizations/:organizationId/producers')
        .post(ensureLoggedIn, ensureUserCanEditOrganization, producers.associate)
        .get(producers.listByOrganization);

    app.route('/api/organizations/:organizationId/producers/:producerId')
        .delete(ensureLoggedIn, ensureUserCanEditOrganization, producers.dissociate);

    /* Datasets */

    function ensureUserCanUnpublishDataset(req, res, next) {
        var organizations = _.pluck(req.user.toObject().organizations, '_id');
        if (!req.publicationInfo) return res.sendStatus(404);
        if (organizations.indexOf(req.publicationInfo.organization.toString()) < 0) return res.sendStatus(401);
        next();
    }

    function ensureUserCanPublishDataset(req, res, next) {
        var organizations = _.pluck(req.user.toObject().organizations, '_id');
        // Existing publication
        if (req.dataset.publication && req.dataset.publication._id) {
            if (!req.dataset.publication.organization) return res.sendStatus(500);
            if (organizations.indexOf(req.dataset.publication.organization.toString()) < 0) res.sendStatus(401);
        } else {
            if (req.body.organization && organizations.indexOf(req.body.organization) < 0) return res.sendStatus(401);
        }
        next();
    }

    app.param('datasetId', datasets.fetch);

    app.route('/api/organizations/:organizationId/datasets')
        .get(datasets.list);

    app.route('/api/datasets/:datasetId/publication')
        .all(ensureLoggedIn)
        .put(ensureUserCanPublishDataset, datasets.publish)
        .delete(ensureUserCanUnpublishDataset, datasets.unpublish);

    app.get('/api/datasets/metrics', datasets.metrics);
    app.get('/api/organizations/:organizationId/datasets/metrics', datasets.metrics);


    app.get('/api/organizations/:organizationId/datasets/grouped-ids', datasets.groupedIds);

    app.get('/api/organizations/:organizationId/datasets/not-published-yet', datasets.notPublishedYet);
    app.get('/api/organizations/:organizationId/datasets/published', datasets.published);
    app.get('/api/organizations/:organizationId/datasets/published-by-others', datasets.publishedByOthers);

    return app;
};
