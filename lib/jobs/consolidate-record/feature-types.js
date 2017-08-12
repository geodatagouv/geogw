'use strict'

const mongoose = require('mongoose')
const { strRight } = require('underscore.string')
const { intersectionBy, differenceBy, clone } = require('lodash')


async function buildResourcesFromFeatureTypes(metadata, featureTypes) {
  const withTypeNameFeatureTypes =
    await Promise.all(featureTypes.map(withTypeNameCheck))

  return {
    dist: withTypeNameFeatureTypes
      .map(ft => ({
        type: 'wfs-featureType',
        service: ft.service,
        typeName: ft.typeName,
        available: !!ft.id,
        uniqueId: ft.service + '@@' + ft.typeName,
      })),
  }
}

async function withTypeNameCheck(featureType) {
  const FeatureType = mongoose.model('FeatureType')
  const result = clone(featureType)
  const typeName = normalizeTypeName(featureType.typeName)
  const featureTypes = await FeatureType.findByService(featureType.service)
  const matchingFeatureType = featureTypes.find(ft => {
    return normalizeTypeName(ft.name) === typeName
  })
  result.id = matchingFeatureType ? matchingFeatureType._id : null
  return result
}

async function resolveFeatureTypes(initialFeatureTypes, cachedFeatureTypes) {
  const Service = mongoose.model('Service')
  const knownOnes = intersectionBy(cachedFeatureTypes, initialFeatureTypes, _unique)
  const newOnes = differenceBy(initialFeatureTypes, knownOnes, _unique)

  const upsertingOnes = newOnes.map(async newFeatureType => {
    const serviceId = await Service.upsert({
      location: newFeatureType.serviceURL,
      protocol: 'wfs',
    })

    return {
      serviceURL: newFeatureType.serviceURL,
      typeName: newFeatureType.typeName,
      service: serviceId,
      relatedTo: newFeatureType.relatedTo,
    }
  })

  const upsertedOnes = await Promise.all(upsertingOnes)
  return knownOnes.concat(upsertedOnes)
}

function normalizeTypeName(typeName) {
  return strRight(typeName, ':').toLowerCase()
}

function _unique(ft) {
  return `${ft.serviceURL}@${ft.typeName}@${ft.relatedTo}`
}

module.exports = { resolveFeatureTypes, normalizeTypeName, buildResourcesFromFeatureTypes }
