'use strict'

const { get } = require('lodash')

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

exports.getTopicCategory = function (record) {
  const candidateValue = (get(record, 'identificationInfo.topicCategory') || '')
    .toLowerCase().trim()
  if (!candidateValue) return
  return candidateValue in TOPIC_CATEGORIES_MAPPING ? TOPIC_CATEGORIES_MAPPING[candidateValue] : 'unknown'
}
