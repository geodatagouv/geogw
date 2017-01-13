const { fetch, show, list, metrics, destroy, update } = require('../controllers/catalogs');
const { isMaintenance } = require('./middlewares/auth');

module.exports = function(app) {

    /* Params */
    app.param('catalogId', fetch);

    /* Routes */
    app.route('/catalogs/:catalogId')
        .get(show)
        .put(isMaintenance, update)
        .delete(isMaintenance, destroy);

    app.route('/catalogs/:catalogId/metrics')
        .get(metrics);

    app.route('/catalogs')
        .get(list);

};
