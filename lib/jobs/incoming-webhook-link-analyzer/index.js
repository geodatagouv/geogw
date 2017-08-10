'use strict'

const mongoose = require('mongoose')
const Record = mongoose.model('ConsolidatedRecord')

async function handleIncomingWebHook({ data: { linkId } }) {
  const relatedRecordIds = await Record
    .distinct('recordId', { '_links.id': linkId })
    .exec()

  const updatingRecords = relatedRecordIds
    .map(id => Record.triggerUpdated(id, 'link checked'))

  return Promise.all(updatingRecords)
}

exports.handler = handleIncomingWebHook
