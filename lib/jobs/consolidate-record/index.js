'use strict'

const mongoose = require('mongoose')
const { uniq, compact } = require('lodash')
const { resolveFeatureTypes, buildResourcesFromFeatureTypes } = require('./feature-types')
const { computeFacets } = require('../../search/facets')
const { convertFromIso, convertFromDublinCore } = require('../../metadata')
const { resolveLinks, buildResourcesFromLinks } = require('./links')

const RecordRevision = mongoose.model('RecordRevision')
const CatalogRecord = mongoose.model('CatalogRecord')
const ConsolidatedRecord = mongoose.model('ConsolidatedRecord')
const Publication = mongoose.model('Publication')


async function consolidateRecord({ data: { recordId, freshness }, log }) {

  const record = await getConsolidatedRecord(recordId)

  if (record.isFresh(freshness)) {
    log('Record is fresh enough. Abording...')
    return
  }

  const recordRevision = await getRecordRevision(recordId)

  const { catalogs, publications } = {
    catalogs: await getCatalogs(recordId),
    publications: await getPublications(recordId),
  }

  const metadata = createDatasetFromRecord(recordRevision)
  const organizations = uniq(metadata.contacts.map(contact => contact.organizationName))

  record
    .set('recordHash', recordRevision.recordHash)
    .set('revisionDate', recordRevision.revisionDate)
    .set('metadata', metadata)


  record.set('organizations', organizations)

  const links = await resolveLinks(metadata.links, record._links)
  record.set('_links', links)

  const featureTypes = await resolveFeatureTypes(metadata.featureTypes, record._featureTypes)
  record.set('_featureTypes', featureTypes)

  const { dist, alt } = consolidateResources([
    await buildResourcesFromLinks(metadata, links),
    await buildResourcesFromFeatureTypes(metadata, featureTypes),
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

function consolidateResources(resources) {
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

exports.handler = consolidateRecord
