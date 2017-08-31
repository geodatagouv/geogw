'use strict'

const mongoose = require('mongoose')

const CatalogRecord = mongoose.model('CatalogRecord')
const RecordRevision = mongoose.model('RecordRevision')
const Record = mongoose.model('ConsolidatedRecord')


async function electRecord({ data: { recordId } }) {

  const catalogRecords = await CatalogRecord
    .find({ recordId })
    .sort('-revisionDate -touchedAt')
    .lean()
    .exec()

  if (catalogRecords.length === 0) {
    throw new Error('No catalog record found for recordId: ' + recordId)
  }

  const { recordHash } = catalogRecords[0]

  const electedRecord = await RecordRevision
    .find({ recordId, recordHash })
    .select('featured')
    .exec()

  // RecordRevision is already featured
  if (electedRecord.featured) return

  await Promise.all([
    RecordRevision.updateOne({ recordId, recordHash }, { $set: { featured: true } }).exec(),
    RecordRevision.updateMany({ recordId, recordHash: { $ne: recordHash } }, { $set: { featured: false } }).exec(),
  ])

  await Record.triggerUpdated(recordId, 'new featured revision')
}

exports.handler = electRecord
