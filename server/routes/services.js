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
        .all(auth.ensureLoggedIn)
        .get(services.list)
        .post(services.create);

    app.route('/services/search')
        .all(auth.ensureLoggedIn)
        .get(services.search);

    app.route('/services/:serviceId')
        .all(auth.ensureLoggedIn)
        .get(services.show);

    app.route('/services/:serviceId/harvest')
        .all(auth.ensureLoggedIn)
        .post(services.harvest);

    app.route('/services/:serviceId/datasets')
        .all(auth.ensureLoggedIn)
        .get(datasets.search);

};
