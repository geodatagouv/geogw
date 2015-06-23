/*
** Module dependencies
*/
var records = require('../controllers/records');

module.exports = function(app) {

    // Params
    app.param('datasetId', records.record);

    // Routes
    app.route('/services/:serviceId/datasets/:datasetId')
        .get(records.show);

    app.route('/services/:serviceId/datasets')
        .get(records.search);

    app.route('/datasets/by-identifier/:identifier')
        .get(records.findByIdentifier);

    app.route('/services/:serviceId/datasets/:datasetId/force-reprocess')
        .post(records.forceReprocess);

};
