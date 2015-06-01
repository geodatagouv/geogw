/*
** Module dependencies
*/
var datasets = require('../controllers/datasets');

module.exports = function(app) {

    // Params
    app.param('datasetId', datasets.dataset);

    // Routes
    app.route('/services/:serviceId/datasets/:datasetId')
        .get(datasets.show);

    app.route('/datasets/by-identifier/:identifier')
        .get(datasets.findByIdentifier);

    app.route('/services/:serviceId/datasets/:datasetId/force-reprocess')
        .post(datasets.forceReprocess);

};
