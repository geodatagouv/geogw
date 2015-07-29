/*
** Module dependencies
*/
var filePackages = require('../controllers/filePackages');
var remoteResources = require('../controllers/remoteResources');
var ogr2ogr = require('../helpers/ogr2ogr');

module.exports = function(app) {

    // Params
    app.param('remoteResourceId', remoteResources.remoteResource);

    // Routes
    app.route('/file-packages/:remoteResourceId')
        .get(remoteResources.show);

    app.route('/file-packages/:remoteResourceId/check')
        .post(remoteResources.check);

    app.route('/file-packages/:remoteResourceId/download')
        .get(filePackages.prepateFilePackageDownload, ogr2ogr.downloadDataset);


};
