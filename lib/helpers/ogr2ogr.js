'use strict'

var ogr2ogr = require('ogr2ogr')


function downloadDataset(req, res) {
  var layerName = req.ogr2ogr.layerName
  var options = layerName ? [layerName] : []

  var ogr2ogrTask = ogr2ogr(req.method === 'HEAD' ? 'fake' : req.ogr2ogr.src)
        .timeout(20000)

    // Projection
  if (req.query.projection === 'WGS84') {
    ogr2ogrTask.project('EPSG:4326')
  } else if (req.query.projection === 'Lambert93') {
    ogr2ogrTask.project('EPSG:2154')
  } else {
    return res.status(400).send({
      code: 400,
      message: 'No valid projection given',
    })
  }

  var fileName = req.ogr2ogr.fileName || layerName || 'dataset'

    // Format
  if (req.query.format === 'GeoJSON') {
    res.type('json')
    res.attachment(fileName + '.json')
  } else if (req.query.format === 'KML') {
    res.type('application/vnd.google-earth.kml+xml')
    res.attachment(fileName + '.kml')
    ogr2ogrTask.format('KML')
  } else if (req.query.format === 'SHP') {
    res.type('application/x-shapefile')
    res.attachment(fileName + '.zip')
    ogr2ogrTask.format('ESRI Shapefile')
  } else if (req.query.format === 'CSV') {
    res.type('text/csv')
    res.attachment(fileName + '.csv')
    ogr2ogrTask.format('CSV')
  } else {
    return res.status(400).send({
      code: 400,
      message: 'No valid format given',
    })
  }

  if (req.method === 'HEAD') {
    res.status(200).end()
  } else {
    var ogrStream = ogr2ogrTask.options(options).stream()

    ogrStream.on('error', function (err) {
      console.error(err)
    })

    ogrStream.pipe(res)
  }
}


exports.downloadDataset = downloadDataset
