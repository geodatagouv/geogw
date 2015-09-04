/*
** Module dependencies
*/
var records = require('../controllers/records');

module.exports = function(app) {

    /* Params */
    app.param('recordId', records.record);

    /* Routes */
    app.route('/records/:recordId')
        .get(records.show);

    app.route('/records')
        .get(records.search);

    app.route('/services/:serviceId/records')
        .get(records.search);

};
