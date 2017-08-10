'use strict'

const mongoose = require('mongoose')
const { uniq, compact } = require('lodash')
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

async function getCatalogs(recordId) {
  const catalogRecords = await CatalogRecord
    .find({ recordId })
    .populate('catalog', 'name')
    .lean()
    .exec()

  if (catalogRecords.length === 0) throw new Error('No catalog record found for recordId: ' + recordId)

  return catalogRecords.map(catalogRecord => catalogRecord.catalog)
}

async function getBestRecordRevision(recordId) {
  const recordRevision = await RecordRevision.findOne({ recordId, featured: true }).exec()
  if (!recordRevision) throw new Error('Featured record revision not found for: ' + recordId)
  return recordRevision
}

function fetchRelatedResources(recordId) {
  return RelatedResource.find({ record: recordId }).exec()
}

async function getConsolidatedRecord(recordId) {
  const record = await ConsolidatedRecord.findOne({ recordId }).exec()
  return record || new ConsolidatedRecord({ recordId })
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

  return record
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

async function exec({ data: { recordId, freshness }, log }) {

  const record = await getConsolidatedRecord(recordId)

  if (record.isFresh(freshness)) {
    log('Record is fresh enough. Abording...')
    return
  }

  const consolidationLock = await getConsolidationLock(recordId)

  try {
    const { catalogs, relatedResources, recordRevision, publications } = {
      catalogs: await getCatalogs(recordId),
      relatedResources: await fetchRelatedResources(recordId),
      recordRevision: await getBestRecordRevision(recordId),
      publications: await fetchPublications(recordId),
    }

    applyRecordRevisionChanges(record, recordRevision)
    applyOrganizationsFilter(record)

    await resolveLinks(record)
    await applyResources(record, relatedResources)

    await record
      .set('catalogs', catalogs.map(catalog => catalog._id))
      .set('facets', computeFacets(record, {
        catalogs,
        publications,
      }))
      .save()

    clearLock(consolidationLock).catch(console.error)

  } catch (err) {
    clearLock(consolidationLock, err)
  }
}

exports.handler = exec
