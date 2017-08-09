'use strict'

const { get } = require('lodash')
const { cleanKeywords } = require('../common/keywords')
const { normalizeContacts } = require('../common/contacts')
const { getLicenseFromLinks, getLicenseFromKeywords, getLicenseFromCatalogs } = require('../common/licenses')
const { getFileNameFromHref } = require('../common/util')
const { getAllContacts } = require('./contacts')
const { getInspireThemeFromKeywords } = require('./themes')
const { getTopicCategory } = require('./categories')
const { getCoupledResources } = require('./services')
const { getConsolidatedExtent } = require('./extent')
const { prepareThumbnails } = require('./thumbnails')
const { getStatus } = require('./statuses')
const { getUpdateFrequency } = require('./update-frequencies')
const { getDates } = require('./dates')
const { getAllKeywords } = require('./keywords')
const { getAllOnLineResources } = require('./onlineResource')
const { getSpatialResolution } = require('./spatial-resolution')

function convert(record) {
  const dataset = { metadataType: 'ISO 19139' }
  dataset.id = record.fileIdentifier
  dataset.title = get(record, 'identificationInfo.citation.title')
  dataset.alternateTitle = get('identificationInfo.citation.alternateTitle')
  dataset.description = get(record, 'identificationInfo.abstract')
  dataset.type = get(record, 'hierarchyLevel')
  dataset.spatialRepresentationType = get(record, 'identificationInfo.spatialRepresentationType')

  // Lineage
  dataset.lineage = get(record, 'dataQualityInfo.lineage.statement')

  // Purpose
  dataset.purpose = get(record, 'identificationInfo.purpose')

  // Credit
  dataset.credit = get(record, 'identificationInfo.credit')

  // Status
  dataset.status = getStatus(record)

  const keywords = getAllKeywords(record)

  // Keywords
  dataset.keywords = cleanKeywords(keywords)

  // INSPIRE theme
  dataset.inspireTheme = getInspireThemeFromKeywords(keywords)

  // Topic category
  dataset.topicCategory = getTopicCategory(record)

  // Thumbnails
  dataset.thumbnails = prepareThumbnails(get(record, 'identificationInfo.graphicOverview'))

  // Contacts
  dataset.contacts = normalizeContacts(getAllContacts(record))

  // Links
  dataset.links = getAllOnLineResources(record).map(resource => ({
    name: resource.name || getFileNameFromHref(resource.linkage),
    href: resource.linkage,
    protocol: resource.protocol,
  }))

  // License
  dataset.license = getLicenseFromLinks(dataset.links) || getLicenseFromKeywords(dataset.keywords) ||
        getLicenseFromCatalogs([])

  // Spatial extent
  dataset.spatialExtent = getConsolidatedExtent(record)

  // Update frequency
  dataset.updateFrequency = getUpdateFrequency(record)

  // Equivalent scale denominator
  dataset.equivalentScaleDenominator = get(record, 'identificationInfo.spatialResolution.equivalentScale.denominator')

  dataset.spatialResolution = getSpatialResolution(record)

  if (dataset.type === 'service') {
    dataset.coupledResources = getCoupledResources(record)
  }

  Object.assign(dataset, getDates(record))
  // Additional rules (custom)
  // ...placeholder...

  return dataset
}


module.exports = {
  convert,
}
