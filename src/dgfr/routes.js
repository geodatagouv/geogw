var bodyParser = require('body-parser');
var _ = require('lodash');

var q = require('../kue').jobs;
var search = require('../helpers/search');

var organizations = require('../controllers/dgfr/organizations');
var producers = require('../controllers/dgfr/producers');
var datasets = require('../controllers/dgfr/datasets');

var mongoose = require('mongoose');

var Service = mongoose.model('Service');

function ensureLoggedIn(req, res, next) {
    if (!req.user) return res.sendStatus(401);
    next();
}

function isAdmin(req, res, next) {
    if (!req.user.isAdmin) return res.sendStatus(403);
    next();
}

module.exports = function (app) {

    app.use(bodyParser.json());

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
            catalog: req.params.catalogId,
            limit: 1,
            opendata: 'yes',
            availability: 'yes',
            facets: { keyword: 0, opendata: 0, availability: 0, representationType: 0 }
        };

        search(query, function (err, result) {
            if (err) return next(err);
            res.send(result.facets.organization || []);
        });
    });

    /* Organizations */

    function ensureUserCanEditOrganization(req, res, next) {
        if (req.user.isAdmin) return next();
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

    app.route('/api/organizations/:organizationId/synchronize')
        .post(ensureLoggedIn, ensureUserCanEditOrganization, function (req, res, next) {
            q.create('dgv:fetch', { organizationId: req.organization._id })
                .save(function (err) {
                    if (err) return next(err);
                    res.send({ code: 200, message: 'Job started' });
                });
        });

    /* Datasets */

    function ensureUserCanUnpublishDataset(req, res, next) {
        var organizations = _.pluck(req.user.toObject().organizations, '_id');
        if (!req.dataset.publication || !req.dataset.publication.organization) return res.sendStatus(500);
        if (req.user.isAdmin) return next();
        if (organizations.indexOf(req.dataset.publication.organization.toString()) < 0) return res.sendStatus(401);
        next();
    }

    function ensureUserCanPublishDataset(req, res, next) {
        var organizations = _.pluck(req.user.toObject().organizations, '_id');
        // Existing publication
        if (req.dataset.publication && req.dataset.publication._id) {
            if (!req.dataset.publication.organization) return res.sendStatus(500);
            if (req.user.isAdmin) return next();
            if (organizations.indexOf(req.dataset.publication.organization.toString()) < 0) res.sendStatus(401);
        } else {
            if (req.user.isAdmin) return next();
            if (req.body.organization && organizations.indexOf(req.body.organization) < 0) return res.sendStatus(401);
        }
        next();
    }

    app.param('datasetId', datasets.fetch);

    app.route('/api/organizations/:organizationId/datasets')
        .get(datasets.list);

    app.get('/api/datasets/statistics', datasets.statistics);

    app.route('/api/datasets/:datasetId/publication')
        .all(ensureLoggedIn)
        .put(ensureUserCanPublishDataset, datasets.publish)
        .delete(ensureUserCanUnpublishDataset, datasets.unpublish);

    app.route('/api/organizations/:organizationId/datasets/publication')
        .delete(ensureLoggedIn, isAdmin, datasets.unpublishAll);

    app.route('/api/organizations/:organizationId/datasets/publish-all')
        .post(ensureLoggedIn, isAdmin, datasets.publishAll);

    app.route('/api/organizations/:organizationId/datasets/synchronize-all')
        .post(ensureLoggedIn, isAdmin, datasets.syncAll);

};
