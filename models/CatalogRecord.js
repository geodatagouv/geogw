'use strict'

/*eslint no-multi-spaces: 0, key-spacing: 0 */
const mongoose = require('mongoose')
const { Schema } = require('mongoose')
const { pick } = require('lodash')

const ObjectId = Schema.Types.ObjectId


const collectionName = 'catalog_records'

/* Schema */
const schema = new Schema({

  /* Identification */
  catalog:        { type: ObjectId,  ref: 'Service', required: true },
  recordId:       { type: String,    required: true },

  /* Attributes */
  recordHash:     { type: String,    required: true },
  revisionDate:   { type: Date },

  /* Dates */
  createdAt:      { type: Date },
  touchedAt:      { type: Date },
  updatedAt:      { type: Date },

})

/* Indexes */
schema.index({ catalog: 1, recordId: 1 }, { unique: true })

/* Statics */
schema.statics = {

  touchExisting: function (catalogRecord) {
    const now = new Date()
    const query = pick(catalogRecord, 'catalog', 'recordId', 'recordHash')
    const changes = { $set: { touchedAt: now } }

    return this.update(query, changes).exec()
      .then(rawResponse => rawResponse.nModified === 1)
  },

  doUpsert: function (catalogRecord) {
    const now = new Date()
    const query = pick(catalogRecord, 'catalog', 'recordId')
    var changes = {
      $setOnInsert: { createdAt: now },
      $set: {
        recordHash: catalogRecord.recordHash,
        revisionDate: catalogRecord.revisionDate,
        updatedAt: now,
        touchedAt: now,
      },
    }

    return this.update(query, changes, { upsert: true }).exec()
      .then(rawResponse => rawResponse.upserted ? 'created' : 'updated')
  },

  upsert: function (catalogRecord) {
    return this
      .touchExisting(catalogRecord)
      .then(touched => touched ? 'touched' : this.doUpsert(catalogRecord))
      .then(upsertStatus => {
        if (upsertStatus === 'touched') return 'touched'
        return mongoose.model('ConsolidatedRecord').triggerUpdated(catalogRecord.recordId, 'record upsert').return(upsertStatus)
      })
  },

}

/* Declare as model */
const model = mongoose.model('CatalogRecord', schema, collectionName)

module.exports = { model, collectionName, schema }
