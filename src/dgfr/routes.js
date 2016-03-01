const bodyParser = require('body-parser');
const _ = require('lodash');
const search = require('../helpers/search');

const organizations = require('../controllers/dgfr/organizations');
const producers = require('../controllers/dgfr/producers');
const datasets = require('../controllers/dgfr/datasets');

const isMaintenance = require('../routes/middlewares/auth').isMaintenance;

const mongoose = require('mongoose');

const Service = mongoose.model('Service');

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

    /* Datasets */

    function ensureUserCanUnpublishDataset(req, res, next) {
        var organizations = _.pluck(req.user.toObject().organizations, '_id');
        if (!req.publicationInfo) return res.sendStatus(404);
        if (req.user.isAdmin) return next();
        if (organizations.indexOf(req.publicationInfo.organization.toString()) < 0) return res.sendStatus(401);
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

    app.get('/api/datasets/metrics', datasets.metrics);

    app.route('/api/datasets/:datasetId/publication')
        .all(ensureLoggedIn)
        .put(ensureUserCanPublishDataset, datasets.publish)
        .delete(ensureUserCanUnpublishDataset, datasets.unpublish);

    app.route('/api/organizations/:organizationId/datasets/publication')
        .delete(ensureLoggedIn, isAdmin, datasets.unpublishAll);

    app.get('/api/organizations/:organizationId/datasets/metrics', datasets.metrics);

    app.route('/api/organizations/:organizationId/datasets/publish-all')
        .post(ensureLoggedIn, isAdmin, datasets.publishAll);

    app.route('/api/organizations/:organizationId/datasets/synchronize-all')
        .post(ensureLoggedIn, isAdmin, datasets.syncAll);

    app.post('/api/datasets/synchronize-all', isMaintenance, datasets.syncAll);

};
