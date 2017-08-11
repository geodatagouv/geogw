'use strict'

const Promise = require('bluebird')
const mongoose = require('mongoose')
const { castOnlineResource } = require('../../metadata/iso/onlineResources')
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

async function processLinks({ recordType, recordId, recordHash, content }) {
  // Conversion into unified model
  if (!['Record', 'MD_Metadata'].includes(recordType)) return
  const convert = recordType === 'Record' ? convertFromDublinCore : convertFromIso
  const record = convert(content)

  // Ignore services
  if (record.type === 'service') return

  const featureTypes = (record.links || [])
    .map(castOnlineResource)
    .filter(result => result.typeName)

  await Promise.all(
    featureTypes
      .map(({ service, typeName }) => {
        const relatedResource = {
          record: recordId,
          originId: recordId,
          originType: 'gmd:onLine',
          originHash: recordHash,
          featureType: {
            candidateName: typeName,
            candidateLocation: service,
          },
        }
        return RelatedResource.upsert(relatedResource)
      })
  )
}

function processCoupledResources({ recordType, recordId, recordHash, content }) {
  // Conversion into unified model
  if (!['Record', 'MD_Metadata'].includes(recordType)) return
  const convert = recordType === 'Record' ? convertFromDublinCore : convertFromIso
  const record = convert(content)

  if (record.serviceProtocol !== 'wfs' || !record.featureTypes) return

  return Promise.each(record.featureTypes, featureType => {

    const relatedResource = {
      record: featureType.relatedTo,
      originId: recordId,
      originHash: recordHash,
      originType: 'srv:coupledResource',

      featureType: {
        candidateName: featureType.typeName,
        candidateLocation: featureType.serviceURL,
      },
    }

    return RelatedResource.upsert(relatedResource)
  })
}

async function handler({ data: { recordId, recordHash } }) {
  const recordRevision = await getRecordRevision(recordId, recordHash)
  await markExistingRelatedResourcesAsChecking(recordId, recordHash)
  await processLinks(recordRevision)
  await processCoupledResources(recordRevision)
  await removeCheckingRelatedResources(recordId, recordHash)
  await mongoose.model('ConsolidatedRecord').triggerUpdated(recordId, 'revision updated') // Only useful for dataset records
}

module.exports = { handler }
