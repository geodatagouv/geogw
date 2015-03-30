/*
** Module dependencies
*/
var datasets = require('../controllers/datasets');

module.exports = function(app) {

    // Params
    app.param('datasetId', datasets.dataset);

    // Routes
    app.route('/datasets/:datasetId')
        .get(datasets.show);

    app.route('/datasets/:datasetId/resources/:resourceId/json')
        .get(function (req, res) {
            res.redirect('/api/datasets/' + req.params.datasetId + '/resources/' + req.params.resourceId + '/download?format=GeoJSON&projection=WGS84');
        });

    app.route('/datasets/:datasetId/resources/:resourceId/download')
        .get(datasets.downloadRelatedResource);

    app.route('/datasets/by-identifier/:identifier')
        .get(datasets.findByIdentifier);

    app.route('/datasets/:datasetId/force-reprocess')
        .post(datasets.forceReprocess);

};
