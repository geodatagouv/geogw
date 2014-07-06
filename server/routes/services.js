/*
** Module dependencies
*/
var services = require('../controllers/services');
var auth = require('./middlewares/auth');
var datasets = require('../controllers/datasets');

module.exports = function(app) {

    // Params
    app.param('serviceId', services.service);

    // Routes
    app.route('/services')
        .get(services.list)
        .post(auth.ensureLoggedIn, services.create);

    app.route('/services/by-protocol/:protocol')
        .get(services.list);

    app.route('/services/:serviceId')
        .get(services.show);

    app.route('/services/:serviceId/sync')
        .post(auth.ensureLoggedIn, services.sync);

    app.route('/services/:serviceId/synchronizations')
        .get(services.listSyncs);

    app.route('/services/:serviceId/datasets')
        .get(datasets.search);

    app.route('/services/by-protocol/:protocol/sync-all')
        .post(auth.isAdmin, services.syncAllByProtocol);

};
