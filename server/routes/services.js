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

    app.route('/services/search')
        .get(services.search);

    app.route('/services/:serviceId')
        .get(services.show);

    app.route('/services/:serviceId/harvest')
        .post(auth.ensureLoggedIn, services.harvest);

    app.route('/services/:serviceId/datasets')
        .get(datasets.search);

};
