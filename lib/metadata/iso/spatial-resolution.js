'use strict'

const { get } = require('lodash')

function getSpatialResolution(record) {
  const { unit, value } = get(record, 'identificationInfo.spatialResolution.distance', {})
  if (!value || isNaN(value)) return
  if (unit && unit.toLowerCase().startsWith('rad')) {
    return { value, unit: 'radian' }
  }
  if (unit && unit.toLowerCase().startsWith('deg')) {
    return { value, unit: 'degree' }
  }
  return { value, unit: 'meter' }
}

module.exports = { getSpatialResolution }
