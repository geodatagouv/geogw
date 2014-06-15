/*
** Module dependencies
*/
var datasets = require('../controllers/datasets');

module.exports = function(app) {

    // Params
    app.param('datasetId', datasets.dataset);

    // Routes
    app.route('/datasets/:datasetId')
        .get(datasets.show);

    app.route('/datasets/by-identifier/:identifier')
        .get(datasets.findByIdentifier);

};
