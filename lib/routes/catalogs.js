const ctrl = require('../controllers/catalogs');

module.exports = function(app) {

    /* Params */
    app.param('catalogId', ctrl.catalog);

    /* Routes */
    app.route('/catalogs/:catalogId')
        .get(ctrl.show);

    app.route('/catalogs/:catalogId/metrics')
        .get(ctrl.metrics);

    app.route('/catalogs')
        .get(ctrl.list);

};
