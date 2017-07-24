'use strict'

const mongoose = require('mongoose')
const { Schema } = mongoose
const { ObjectId } = Schema.Types

const schema = new Schema({
  // Parent service
  service: { type: ObjectId, ref: 'Service', index: true },

  // Feature type name
  name: { type: String, required: true, index: true },

  // Status
  available: { type: Boolean, required: true, index: true },

  // Metadata
  title: { type: String },
  abstract: { type: String },
  keywords: { type: [String] },
})

schema.index({ service: 1, name: 1 }, { unique: true })

schema.static('upsert', function (service, featureType) {
  const { name, title, abstract, keywords } = featureType
  const withUpsert = { upsert: true }
  return this.update({ service, name }, { $set: { title, abstract, keywords, available: true } }, withUpsert).exec()
})

schema.static('markAllAsUnavailable', function (service, except = []) {
  const exceptNames = except.map(ft => ft.name)
  const withMulti = { multi: true }
  return this.update({ service, name: { $nin: exceptNames } }, { $set: { available: false } }, withMulti).exec()
})

schema.static('findByService', function (service) {
  return this.find({ service, available: true }).exec()
})

mongoose.model('FeatureType', schema)
