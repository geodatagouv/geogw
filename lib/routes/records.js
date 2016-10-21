/*
** Module dependencies
*/
var records = require('../controllers/records');

module.exports = function(app) {

    /* Params */
    app.param('recordId', records.record);
    app.param('recordHash', records.recordRevision);

    /* Routes */
    app.route('/records/:recordId')
        .get(records.show);

    app.route('/records/:recordId/consolidate')
        .post(records.consolidate);

    app.route('/records')
        .get(records.search);

    app.route('/services/:serviceId/records')
        .get(records.search);

    app.get('/records/:recordId/related-resources', records.showRelatedResources);

    app.get('/records/:recordId/revisions/:recordHash', records.showRevision);

};
