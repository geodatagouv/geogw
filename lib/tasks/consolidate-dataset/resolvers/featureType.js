'use strict'

const mongoose = require('mongoose')

const { normalizeFeatureTypeName } = require('../../../helpers/featureType')

const FeatureType = mongoose.model('FeatureType')

function resolve(relatedResource) {
  const { featureType: { candidateName, matchingService } } = relatedResource
  if (!matchingService) return

  const normalizedCandidateName = normalizeFeatureTypeName(candidateName)

  return FeatureType.findByService(matchingService)
    .then(featureTypes => {
      const matchingFeatureType = featureTypes.find(ft => {
        return normalizeFeatureTypeName(ft.name) === normalizedCandidateName
      })

      const typeName = matchingFeatureType ? matchingFeatureType.name : candidateName

      return {
        type: 'wfs-featureType',
        service: matchingService,
        typeName,
        available: !!matchingFeatureType,
        uniqueId: matchingService + '@@' + typeName,
      }
    })
}

module.exports = { resolve }
