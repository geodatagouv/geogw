const { fetch, show, list, metrics } = require('../controllers/catalogs');

module.exports = function(app) {

    /* Params */
    app.param('catalogId', fetch);

    /* Routes */
    app.route('/catalogs/:catalogId')
        .get(show);

    app.route('/catalogs/:catalogId/metrics')
        .get(metrics);

    app.route('/catalogs')
        .get(list);

};
