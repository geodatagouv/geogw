/*
** Module dependencies
*/
var filePackages = require('../controllers/filePackages');
var remoteResources = require('../controllers/remoteResources');
var ogr2ogr = require('../helpers/ogr2ogr');

module.exports = function(app) {

    // Params
    app.param('remoteResourceId', remoteResources.remoteResource);

    app.route('/file-packages/:remoteResourceId/download')
        .get(filePackages.loadLayer, filePackages.prepateFilePackageDownload, ogr2ogr.downloadDataset);

    app.route('/file-packages/:remoteResourceId/:layerName/download')
        .get(filePackages.loadLayer, filePackages.prepateFilePackageDownload, ogr2ogr.downloadDataset);

    app.get('/file-packages/:remoteResourceId/records', remoteResources.records);

};
