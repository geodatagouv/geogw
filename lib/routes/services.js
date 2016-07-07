/*
** Module dependencies
*/
var services = require('../controllers/services');
var featureTypes = require('../controllers/featureTypes');
var ogr2ogr = require('../helpers/ogr2ogr');


module.exports = function(app) {

    // Params
    app.param('serviceId', services.service);
    app.param('typeName', featureTypes.featureType);

    // Routes
    app.route('/services')
        .get(services.list)
        .post(services.create);

    app.route('/services/by-protocol/:protocol')
        .get(services.list);

    app.route('/services/:serviceId')
        .get(services.show);

    app.route('/services/:serviceId/sync')
        .post(services.sync);

    app.route('/services/:serviceId/synchronizations')
        .get(services.listSyncs);

    app.route('/services/by-protocol/:protocol/sync-all')
        .post(services.syncAllByProtocol);

    app.route('/services/:serviceId/feature-types/:typeName')
        .get(featureTypes.show);

    app.route('/services/:serviceId/feature-types/:typeName/download')
        .get(featureTypes.prepateFeatureTypeDownload, ogr2ogr.downloadDataset);

    app.route('/services/:serviceId/feature-types')
        .get(featureTypes.list);

};
