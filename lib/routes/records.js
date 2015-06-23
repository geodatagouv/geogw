/*
** Module dependencies
*/
var records = require('../controllers/records');

module.exports = function(app) {

    /* Params */
    app.param('recordId', records.record);

    /* Routes */
    app.route('/services/:serviceId/records/:recordId')
        .get(records.show);

    app.route('/services/:serviceId/records')
        .get(records.search);

    app.route('/records/by-identifier/:identifier')
        .get(records.findByIdentifier);

    app.route('/services/:serviceId/records/:recordId/force-reprocess')
        .post(records.forceReprocess);

    /* Compatibility */
    app.route('/services/:serviceId/datasets/:recordId')
        .get(records.show);

    app.route('/services/:serviceId/datasets')
        .get(records.search);

    app.route('/datasets/by-identifier/:identifier')
        .get(records.findByIdentifier);

    app.route('/services/:serviceId/datasets/:recordId/force-reprocess')
        .post(records.forceReprocess);

};
