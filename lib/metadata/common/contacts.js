'use strict'

const { compact } = require('lodash')
const normalizeProducerNames = require('../../../france/normalizeProducerNames')

exports.normalizeContacts = function (contacts) {
  return compact(contacts.map(contact => {
    const normalization = {}
    try {
      normalization.organizationName = normalizeProducerNames(contact.organizationName)
    } catch (err) {
      return
    }
    return Object.assign({}, contact, normalization)
  }))
}
