'use strict'

const mongoose = require('mongoose')
const { lock } = require('../../util/lock')

const CatalogRecord = mongoose.model('CatalogRecord')
const RecordRevision = mongoose.model('RecordRevision')
const Record = mongoose.model('ConsolidatedRecord')


// TODO: Integrate optional lock mechanism directly into jobs
function getElectionLock(recordId) {
  return lock(`${recordId}:election`, 5000)
}

async function electRecord({ data: { recordId } }) {

  const electionLock = await getElectionLock(recordId)

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
  if (electedRecord.featured) {
    electionLock.unlock().catch(console.error)
    return
  }

  await Promise.all([
    RecordRevision.updateOne({ recordId, recordHash }, { $set: { featured: true } }).exec(),
    RecordRevision.updateMany({ recordId, recordHash: { $ne: recordHash } }, { $set: { featured: false } }).exec(),
  ])

  await electionLock.unlock().catch(console.error)

  await Record.triggerUpdated(recordId, 'new featured revision')
}

exports.handler = electRecord
