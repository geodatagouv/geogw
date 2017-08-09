'use strict'

const { get } = require('lodash')

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

exports.getStatus = function (record) {
  const candidateValue = (get(record, 'identificationInfo.status') || '')
    .toLowerCase().trim()
  if (!candidateValue) return
  return candidateValue in STATUSES_MAPPING ? STATUSES_MAPPING[candidateValue] : 'unknown'
}
