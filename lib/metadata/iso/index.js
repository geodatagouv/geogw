'use strict'

const { get, uniq, compact, flatten, groupBy } = require('lodash')
const bboxPolygon = require('@turf/bbox-polygon')
const union = require('@turf/union')
const moment = require('moment')


function getUniformArray(src) {
  return uniq(compact(flatten(src)))
}

function getAllKeywords(metadata) {
  const candidateKeywords = [get(metadata, 'identificationInfo.topicCategory')]
  const descriptiveKeywords = get(metadata, 'identificationInfo.descriptiveKeywords') || []
  descriptiveKeywords.forEach(dk => candidateKeywords.push(dk.keyword))
  return getUniformArray(candidateKeywords)
}

function getAllOnLineResources(metadata) {
  const candidateLinks = []
  const transferOptions = get(metadata, 'distributionInfo.transferOptions') || []
  transferOptions.forEach(to => (to.onLine || []).forEach(resource => candidateLinks.push(resource)))
  return getUniformArray(candidateLinks)
}

function getConsolidatedExtent(metadata) {
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

const UPDATE_FREQUENCIES = [
  'continual',
  'daily',
  'weekly',
  'fortnightly',
  'quarterly',
  'biannually',
  'annually',
  'asNeeded',
  'irregular',
  'notPlanned',
  'unknown',
]

const UPDATE_FREQUENCIES_MAPPING = {}

UPDATE_FREQUENCIES.forEach(uf => UPDATE_FREQUENCIES_MAPPING[uf.toLowerCase()] = uf)

function getUpdateFrequency(metadata) {
  const candidateValue = (get(metadata, 'identificationInfo.resourceMaintenance.maintenanceAndUpdateFrequency') || '')
    .toLowerCase()
  if (!candidateValue) return
  return candidateValue in UPDATE_FREQUENCIES_MAPPING ? UPDATE_FREQUENCIES_MAPPING[candidateValue] : 'other'
}

function getDates(metadata) {
  const rawDates = get(metadata, 'identificationInfo.citation.date', [])
  const validDates = rawDates.filter(date => moment(date.date).isValid() && date.dateType)
  const groupedDates = groupBy(validDates, 'dateType')
  const dates = {}

  function selectOne(dates, sort) {
    const candidates = dates.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return sort === 'older' ? dateA > dateB : dateA < dateB
    })
    return candidates[0].date
  }

  if (groupedDates.creation) {
    dates.creationDate = selectOne(groupedDates.creation, 'older')
  }

  if (groupedDates.revision) {
    dates.revisionDate = selectOne(groupedDates.revision, 'last')
  }

  if (!dates.revisionDate && dates.creationDate) {
    dates.revisionDate = dates.creationDate
  }

  return dates
}

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

const STATUSES = [
  'completed',
  'historicalArchive',
  'obsolete',
  'onGoing',
  'planned',
  'required',
  'underDevelopment',
]

const STATUSES_MAPPING = {}

STATUSES.forEach(value => STATUSES_MAPPING[value.toLowerCase()] = value)

function getStatus(record) {
  const candidateValue = (get(record, 'identificationInfo.status') || '')
    .toLowerCase().trim()
  if (!candidateValue) return
  return candidateValue in STATUSES_MAPPING ? STATUSES_MAPPING[candidateValue] : 'unknown'
}

const TOPIC_CATEGORIES = [
  'farming',
  'biota',
  'boundaries',
  'climatologyMeteorologyAtmosphere',
  'economy',
  'elevation',
  'environment',
  'geoscientificInformation',
  'health',
  'imageryBaseMapsEarthCover',
  'intelligenceMilitary',
  'inlandWaters',
  'location',
  'oceans',
  'planningCadastre',
  'society',
  'structure',
  'transportation',
  'utilitiesCommunication',
]

const TOPIC_CATEGORIES_MAPPING = {}

TOPIC_CATEGORIES.forEach(value => TOPIC_CATEGORIES_MAPPING[value.toLowerCase()] = value)

function getTopicCategory(record) {
  const candidateValue = (get(record, 'identificationInfo.topicCategory') || '')
    .toLowerCase().trim()
  if (!candidateValue) return
  return candidateValue in TOPIC_CATEGORIES_MAPPING ? TOPIC_CATEGORIES_MAPPING[candidateValue] : 'unknown'
}


module.exports = {
  getAllKeywords,
  getAllOnLineResources,
  getConsolidatedExtent,
  getUpdateFrequency,
  getDates,
  getSpatialResolution,
  getStatus,
  getTopicCategory,
}
