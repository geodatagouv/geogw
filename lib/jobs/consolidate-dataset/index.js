'use strict'

const mongoose = require('mongoose')
const { uniq, compact } = require('lodash')
const featureTypeResolve = require('./resolvers/featureType').resolve
const { computeFacets } = require('../../search/facets')
const Promise = require('bluebird')
const { convertFromIso, convertFromDublinCore } = require('../../metadata')
const { lock } = require('../../util/lock')
const { extractAndResolveLinks, buildResourcesFromLinks } = require('./links')

const RecordRevision = mongoose.model('RecordRevision')
const CatalogRecord = mongoose.model('CatalogRecord')
const ConsolidatedRecord = mongoose.model('ConsolidatedRecord')
const RelatedResource = mongoose.model('RelatedResource')
const Publication = mongoose.model('Publication')


async function consolidateRecord({ data: { recordId, freshness }, log }) {

  const record = await getConsolidatedRecord(recordId)

  if (record.isFresh(freshness)) {
    log('Record is fresh enough. Abording...')
    return
  }

  const consolidationLock = await getConsolidationLock(recordId)

  try {
    const recordRevision = await getRecordRevision(recordId)

    const { catalogs, relatedResources, publications } = {
      catalogs: await getCatalogs(recordId),
      relatedResources: await getRelatedResources(recordId),
      publications: await getPublications(recordId),
    }

    const metadata = createDatasetFromRecord(recordRevision)
    const organizations = uniq(metadata.contacts.map(contact => contact.organizationName))

    record
      .set('recordHash', recordRevision.recordHash)
      .set('revisionDate', recordRevision.revisionDate)
      .set('metadata', metadata)


    record.set('organizations', organizations)

    const links = await extractAndResolveLinks(metadata, record._links)
    record.set('_links', links)

    const { dist, alt } = consolidateResources([
      await buildResourcesFromLinks(metadata, links),
      await buildResourcesFromFeatureTypes(recordRevision.recordHash, relatedResources),
    ])

    record
      .set('dataset.distributions', dist)
      .set('alternateResources', alt)

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

  return catalogRecords.map(catalogRecord => catalogRecord.catalog)
}

async function getRecordRevision(recordId) {
  const recordRevision = await RecordRevision.findOne({ recordId, featured: true }).exec()
  if (!recordRevision) throw new Error('Featured record revision not found for: ' + recordId)
  return recordRevision
}

function getRelatedResources(recordId) {
  return RelatedResource.find({ record: recordId }).exec()
}

async function getConsolidatedRecord(recordId) {
  const record = await ConsolidatedRecord.findOne({ recordId }).exec()
  return record || new ConsolidatedRecord({ recordId })
}

function getPublications(datasetId) {
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

async function consolidateResources(resources) {
  let alt = []
  let dist = []

  resources.forEach(r => {
    if (r.alt) alt = alt.concat(r.alt)
    if (r.dist) dist = dist.concat(r.dist)
  })

  dist = uniq(compact(dist), 'uniqueId')
  alt = uniq(alt, 'location')

  return { dist, alt }
}

async function buildResourcesFromFeatureTypes(recordHash, relatedResources) {
  const dist = await Promise.all(
    relatedResources
      .filter(resource =>  (
        resource.originType !== 'gmd:onLine' || resource.originHash === recordHash
      ))
      .filter(resource => resource.type === 'feature-type')
      .map(featureTypeResolve)
  )

  return { dist }
}

exports.handler = consolidateRecord
