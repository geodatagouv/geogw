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

    app.route('/services/:serviceId/datasets/:datasetId/resources/:resourceId/json')
        .get(function (req, res) {
            res.redirect('/api/services/' + req.params.serviceId + '/datasets/' + req.params.datasetId + '/resources/' + req.params.resourceId + '/download?format=GeoJSON&projection=WGS84');
        });

    app.route('/services/:serviceId/datasets/:datasetId/resources/:resourceId/download')
        .get(datasets.downloadRelatedResource);

    app.route('/datasets/by-identifier/:identifier')
        .get(datasets.findByIdentifier);

    app.route('/services/:serviceId/datasets/:datasetId/force-reprocess')
        .post(datasets.forceReprocess);

};
