'use strict'

const mongoose = require('mongoose')
const { pick, uniq, compact } = require('lodash')
const featureTypeResolve = require('./resolvers/featureType').resolve
const { computeFacets } = require('../../search/facets')
const Promise = require('bluebird')
const { convertFromIso, convertFromDublinCore } = require('../../metadata')
const { lock } = require('../../util/lock')
const { resolveLinks } = require('./links')

const RecordRevision = mongoose.model('RecordRevision')
const CatalogRecord = mongoose.model('CatalogRecord')
const ConsolidatedRecord = mongoose.model('ConsolidatedRecord')
const RelatedResource = mongoose.model('RelatedResource')
const Publication = mongoose.model('Publication')


function clearLock(lock, err) {
  return lock.unlock().then(() => { if (err) throw err })
}

function getConsolidationLock(recordId) {
  return lock(`${recordId}:consolidation`, 10000)
}

function getCatalogRecords(recordId) {
  return CatalogRecord
    .find({ recordId })
    .sort('-revisionDate -touchedAt')
    .populate('catalog', 'name')
    .lean()
    .exec()
    .then(catalogRecords => {
      if (catalogRecords.length === 0) throw new Error('No catalog record found for recordId: ' + recordId)
      return catalogRecords
    })
}

function getBestRecordRevision(catalogRecords) {
  return RecordRevision.findOne(pick(catalogRecords[0], 'recordId', 'recordHash')).exec()
    .then(recordRevision => {
      if (!recordRevision) throw new Error('Record revision not found for: ' + recordRevision.toJSON())
      return recordRevision
    })
}

function fetchRelatedResources(recordId) {
  return RelatedResource.find({ record: recordId }).exec()
}

function getConsolidatedRecord(recordId) {
  return ConsolidatedRecord.findOne({ recordId }).exec()
    .then(record => {
      return record || new ConsolidatedRecord({ recordId })
    })
}

function fetchPublications(datasetId) {
  return Publication.find({ recordId: datasetId }).exec()
}

function createDatasetFromRecord(recordRevision) {
  if (recordRevision.recordType === 'Record') {
    return convertFromDublinCore(recordRevision.content)
  }
  if (recordRevision.recordType === 'MD_Metadata') {
    return convertFromIso(recordRevision.content)
  }
  throw new Error('Not supported record type: ' + recordRevision.recordType)
}

function applyRecordRevisionChanges(record, recordRevision) {
  // if (record.recordHash && record.recordHash === recordRevision.recordHash) return Promise.resolve(record);
  record
    .set('recordHash', recordRevision.recordHash)
    .set('revisionDate', recordRevision.revisionDate)
    .set('metadata', createDatasetFromRecord(recordRevision))

  return Promise.resolve(record)
}

function applyOrganizationsFilter(record) {
  const organizations = uniq(record.metadata.contacts.map(contact => contact.organizationName))
  return record.set('organizations', organizations)
}

async function applyResources(record, relatedResources) {
  const distPromises = []
  let alt = []

  relatedResources.forEach(function (resource) {
    if (resource.originType === 'gmd:onLine' && resource.originHash !== record.recordHash) {
      // Ignore remote resources from other revisions
      return
    }
    if (resource.type === 'feature-type') {
      distPromises.push(featureTypeResolve(resource))
    }
  })

  return Promise.all(distPromises).then(dist => {
    dist = dist.concat(record.linksResources.filter(resource => resource.type === 'file-package'))
    alt = alt.concat(record.linksResources.filter(resource => resource.type === 'page'))

    return record
      .set('dataset.distributions', uniq(compact(dist), 'uniqueId'))
      .set('alternateResources', uniq(alt, 'location'))
  })
}

function exec({ data: { recordId, freshness }, log }) {

  return getConsolidatedRecord(recordId).then(record => {
    if (record.isFresh(freshness)) {
      log('Record is fresh enough. Abording...')
      return
    } else {
      return getConsolidationLock(recordId)
        .then(lock => {
          return getCatalogRecords(recordId)
            .then(catalogRecords => {
              return Promise.join(
                fetchRelatedResources(recordId),
                getBestRecordRevision(catalogRecords),
                fetchPublications(recordId),

                (relatedResources, recordRevision, publications) => {
                  return Promise.try(() => applyRecordRevisionChanges(record, recordRevision))
                    .then(() => resolveLinks(record))
                    .then(() => applyOrganizationsFilter(record))
                    .then(() => applyResources(record, relatedResources))
                    .then(() => {
                      return record
                        .set('catalogs', catalogRecords.map(catalogRecord => catalogRecord.catalog._id))
                        .set('facets', computeFacets(record, {
                          catalogs: catalogRecords.map(catalogRecord => catalogRecord.catalog),
                          publications,
                        }))
                        .save()
                    })
                    .then(() => clearLock(lock))
                    .thenReturn()
                }
              )
            })
            .catch(err => clearLock(lock, err))
        })
    }
  })
}

exports.handler = exec
exports.applyResources = applyResources
exports.applyOrganizationsFilter = applyOrganizationsFilter
exports.applyRecordRevisionChanges = applyRecordRevisionChanges
exports.getConsolidatedRecord = getConsolidatedRecord
exports.fetchRelatedResources = fetchRelatedResources
exports.getCatalogRecords = getCatalogRecords
exports.getBestRecordRevision = getBestRecordRevision
