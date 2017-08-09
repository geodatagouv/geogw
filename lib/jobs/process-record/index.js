'use strict'

const Promise = require('bluebird')
const hasha = require('hasha')
const debug = require('debug')('geogw:process-record')
const mongoose = require('mongoose')
const { OnlineResource } = require('../../metadata/iso/onlineResources')
const { isWFSService, getWFSServiceLocation, getCoupledResources } = require('../../metadata/iso/services')
const { convertFromDublinCore, convertFromIso } = require('../../metadata')

const RecordRevision = mongoose.model('RecordRevision')
const RelatedResource = mongoose.model('RelatedResource')


function markExistingRelatedResourcesAsChecking(originId, originHash) {
  return RelatedResource.markAsChecking({ originId, originHash })
}

function removeCheckingRelatedResources(originId, originHash) {
  return RelatedResource.remove({ originId, originHash, checking: true })
}

function getRecordRevision(recordId, recordHash) {
  return RecordRevision.findOne({ recordId, recordHash }).exec()
    .then(recordRevision => {
      if (!recordRevision) throw new Error('RecordRevision not found for: ' + { recordId, recordHash }.toJSON())
      return recordRevision
    })
}

function processLinks(recordRevision) {
  const record = recordRevision.content
  const recordType = recordRevision.recordType

  // Conversion into unified model
  if (!['Record', 'MD_Metadata'].includes(recordType)) return
  const convert = recordType === 'Record' ? convertFromDublinCore : convertFromIso
  const unifiedRecord = convert(record)

  // Ignore services
  if (unifiedRecord.type === 'service') return

  return Promise.each(unifiedRecord.links || [], resource => {
    try {
      resource = new OnlineResource(resource)
    } catch (err) {
      return
    }

    const relatedResource = {
      record: recordRevision.recordId,
      originId: recordRevision.recordId,
      originType: 'gmd:onLine',
      originHash: recordRevision.recordHash,
    }

    if (resource.isWfsFeatureType()) {
      relatedResource.featureType = {
        candidateName: resource.getFeatureTypeName(),
        candidateLocation: resource.getNormalizedWfsServiceLocation(),
      }
      return RelatedResource.upsert(relatedResource)
    }

    if (resource.isWmsLayer()) {
      // Do nothing
      return
    }

    // Links are no more handled here
    return
  })
}

function processCoupledResources(recordRevision) {
  const record = recordRevision.content

  const coupledResources = getCoupledResources(record)
  const serviceLocation = getWFSServiceLocation(record)

  if (record.hierarchyLevel !== 'service' || !coupledResources.length || !serviceLocation || !isWFSService(record)) return []

  debug('process coupled resources')

  return Promise.each(coupledResources, coupledResource => {

    const relatedResource = {
      record: hasha(coupledResource.identifier, { algorithm: 'sha1' }),
      originId: recordRevision.recordId,
      originHash: recordRevision.recordHash,
      originType: 'srv:coupledResource',

      featureType: {
        candidateName: coupledResource.scopedName,
        candidateLocation: serviceLocation,
      },
    }

    return RelatedResource.upsert(relatedResource)
  })
}

function handler({ data: { recordId, recordHash } }) {
  return getRecordRevision(recordId, recordHash)
    .then(recordRevision => {
      return markExistingRelatedResourcesAsChecking(recordId, recordHash)
        .then(() => processLinks(recordRevision))
        .then(() => processCoupledResources(recordRevision))
    })
    .then(() => removeCheckingRelatedResources(recordId, recordHash))
    .then(() => mongoose.model('ConsolidatedRecord').triggerUpdated(recordId, 'revision updated')) // Only useful for dataset records
}

module.exports = { handler }
