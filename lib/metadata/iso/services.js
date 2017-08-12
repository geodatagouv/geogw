'use strict'

const { get, pick, chain } = require('lodash')
const { getAllKeywords } = require('./keywords')
const { isPublicURL } = require('../../util/url')
const { getAllOnLineResources } = require('./onlineResources')
const { getNormalizedWfsServiceLocation } = require('../common/services')

function isWFSService(record) {
  const title = get(record, 'identificationInfo.citation.title', '').toLowerCase()
  const keywordsStr = getAllKeywords(record).join('').toLowerCase()
  const serviceType = get(record, 'identificationInfo.serviceType', '').toLowerCase()

  return serviceType === 'download' ||
      serviceType.includes('wfs') ||
      title.includes('wfs') ||
      keywordsStr.includes('wfs') ||
      keywordsStr.includes('infofeatureaccessservice')
}

function getWFSServiceLocation(record) {
  const onlineResources = getAllOnLineResources(record)

  const candidateResources = chain(onlineResources)
    .map(resource => {
      const { linkage, protocol } = resource
      if (!linkage) return
      if (!isPublicURL(linkage)) return

      const hasWfsInLocation = linkage && linkage.toLowerCase().includes('wfs')
      const hasWfsInProtocol = protocol && protocol.toLowerCase().includes('wfs')
      if (hasWfsInLocation || hasWfsInProtocol) {
        return resource
      }
    })
    .compact()
    .value()

  if (candidateResources.length === 0) {
    return
  } else if (candidateResources.length > 1) {
    return
  }

  return getNormalizedWfsServiceLocation(candidateResources[0].linkage)
}

function getCoupledResources(record) {
  return get(record, 'identificationInfo.coupledResource', [])
    .filter(cr => (cr.identifier && cr.scopedName))
    .map(cr => pick(cr, 'identifier', 'scopedName'))
}


module.exports = {
  isWFSService,
  getWFSServiceLocation,
  getCoupledResources,
}
