'use strict'

const { getLastLinkCheck } = require('../../linkAnalyzer')
var filePackages = require('../controllers/filePackages')
var ogr2ogr = require('../../helpers/ogr2ogr')

module.exports = function(app) {

  // Params
  app.param('remoteResourceId', function (req, res, next, id) {
    getLastLinkCheck(id)
      .then(lastCheck => {
        req.linkCheck = lastCheck
        next()
      })
      .catch(() => res.sendStatus(404))
  })

  app.route('/file-packages/:remoteResourceId/download')
    .get(filePackages.loadLayer, filePackages.prepateFilePackageDownload, ogr2ogr.downloadDataset)

  app.route('/file-packages/:remoteResourceId/:layerName/download')
    .get(filePackages.loadLayer, filePackages.prepateFilePackageDownload, ogr2ogr.downloadDataset)

}
