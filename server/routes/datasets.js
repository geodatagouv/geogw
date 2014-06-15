/*
** Module dependencies
*/
var auth = require('./middlewares/auth');
var datasets = require('../controllers/datasets');

module.exports = function(app) {

    // Params
    app.param('datasetId', datasets.dataset);

    // Routes
    app.route('/datasets/:datasetId')
        .all(auth.ensureLoggedIn)
        .get(datasets.show);

    app.route('/datasets/by-identifier/:identifier')
        .all(auth.ensureLoggedIn)
        .get(datasets.findByIdentifier);

};
