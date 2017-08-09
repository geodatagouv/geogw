'use strict'

const { get, pick, chain } = require('lodash')
const { getAllKeywords } = require('./keywords')
const { OnlineResource, getAllOnLineResources } = require('./onlineResources')

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
      try {
        resource = new OnlineResource(resource)
      } catch (err) {
        return
      }
      const hasWfsInLocation = resource.sourceLocation && resource.sourceLocation.toLowerCase().includes('wfs')
      const hasWfsInProtocol = resource.sourceProtocol && resource.sourceProtocol.toLowerCase().includes('wfs')
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

  return candidateResources[0].getNormalizedWfsServiceLocation()
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
