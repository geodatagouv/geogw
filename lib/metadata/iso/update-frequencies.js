'use strict'

const { get } = require('lodash')

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

exports.getUpdateFrequency = function (metadata) {
  const candidateValue = (get(metadata, 'identificationInfo.resourceMaintenance.maintenanceAndUpdateFrequency') || '')
    .toLowerCase()
  if (!candidateValue) return
  return candidateValue in UPDATE_FREQUENCIES_MAPPING ? UPDATE_FREQUENCIES_MAPPING[candidateValue] : 'other'
}
