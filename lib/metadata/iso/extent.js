'use strict'

const { get } = require('lodash')
const bboxPolygon = require('@turf/bbox-polygon')
const union = require('@turf/union')

exports.getConsolidatedExtent = function (metadata) {
  const candidateExtent = get(metadata, 'identificationInfo.extent')
  if (!candidateExtent) return
  const bboxPolygons = metadata.identificationInfo.extent
    .map(extent => {
      const g = extent.geographicElement
      if (!g) return
      return [g.westBoundLongitude, g.southBoundLatitude, g.eastBoundLongitude, g.northBoundLatitude]
    })
    .filter(bbox => !!bbox)
    .map(bbox => bboxPolygon(bbox))

  if (bboxPolygons.length === 0) return

  return bboxPolygons.length === 1 ? bboxPolygons[0].geometry : union(...bboxPolygons).geometry
}
