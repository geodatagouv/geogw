'use strict'

/*eslint no-multi-spaces: 0, key-spacing: 0 */
const mongoose = require('mongoose')
const { Schema } = require('mongoose')
const { enqueue } = require('../util/jobs')
const { getHash } = require('../util/hash')
const moment = require('moment')
const { through } = require('mississippi')
const Promise = require('bluebird')

const ObjectId = Schema.Types.ObjectId
const Mixed = Schema.Types.Mixed

/* Distribution */

const DISTRIBUTION_TYPES = [
  'wfs-featureType',
  'file-package',
]

const DistributionSchema = new Schema({
  type: { type: String, enum: DISTRIBUTION_TYPES, required: true },
  service: { type: ObjectId, ref: 'Service' },

  name: { type: String }, // distribution label

  available: { type: Boolean },

  /* FeatureType */
  typeName: { type: String },

  /* File package */
  location: { type: String },
  hashedLocation: { type: String },
  layer: { type: String },
  originalDistribution: Boolean,
})


const collectionName = 'consolidated_records'

const FIELDS_TO_OMIT_IN_HASH = [
  'createdAt',
  'updatedAt',
  'consolidatedAt',
]

const schema = new Schema({

  hash: String,

  /* Identification */
  recordId:              { type: String,     required: true, unique: true },

  /* Attributes */
  recordHash:            { type: String,     required: true },
  revisionDate:          { type: Date },

  /* Catalogs */
  catalogs:             [{ type: ObjectId, ref: 'Service', index: true }],

  /* Content */
  metadata:              { type: Mixed },
  dataset: {
    distributions:     [DistributionSchema],
  },
  organizations:         { type: [String], index: true },
  alternateResources:    [Mixed],

  /* Facets */
  facets:                { type: [Mixed],   select: false },

  /* Links */
  links: {
    ids: { type: [String], index: true },
    mapping: { type: Mixed },
  },

  /* Dates */
  createdAt: { type: Date },
  updatedAt: { type: Date },
  consolidatedAt: { type: Date, index: true },
})

/* Indexes */
schema.index({ 'facets.name': 1, 'facets.value': 1 })

const textIndexOptions = {
  default_language: 'french',
  language_override: 'idioma', // To avoid conflict with `language` field of ISO-19139 JSON schema
  name: 'default_text_index',
  weights: {
    'metadata.title': 20,
    'metadata.keywords': 10,
    'metadata.abstract': 2,
    'metadata.lineage': 1,
    'organizations': 15,
  },
}

const textIndexDefinition = {
  'metadata.title': 'text',
  'metadata.abstract': 'text',
  'metadata.keywords': 'text',
  'metadata.lineage': 'text',
  'organizations': 'text',
}

schema.index(textIndexDefinition, textIndexOptions)

schema.pre('save', function (next) {
  const hash = getHash(this.toObject(), { except: FIELDS_TO_OMIT_IN_HASH })
  const now = new Date()

  if (this.isNew) {
    this.set('createdAt', now)
  }

  if (this.hash && this.hash === hash) {
    FIELDS_TO_OMIT_IN_HASH.forEach(field => this.unmarkModified(field))
  } else {
    this.set('hash', hash)
    this.set('updatedAt', now)
  }

  this.set('consolidatedAt', now)
  next()
})

schema.method('isFresh', function (freshness = 3600) {
  return this.consolidatedAt && moment(this.consolidatedAt).add(freshness, 'seconds').isAfter()
})

/* Statics */

schema.static('triggerUpdated', function (recordId, reason) {
  return enqueue('dataset-consolidate', { recordId, freshness: 0, reason })
})

schema.static('markAsOutdated', function (query = {}) {
  return this.update(query, { $set: { consolidatedAt: new Date(2000, 0) } }, { multi: true }).exec()
})

schema.static('consolidateMany', function ({ freshness = 3600, limit = 1000 }) {
  let count = 0

  return new Promise((resolve, reject) => {
    this.find({ consolidatedAt: { $lt: moment().subtract(freshness, 'seconds').toDate() } })
      .select('recordId')
      .sort('consolidatedAt')
      .limit(limit)
      .lean()
      .cursor()
      .pipe(through.obj((record, enc, cb) => {
        return enqueue('dataset-consolidate', { recordId: record.recordId, freshness })
          .then(() => {
            count++
            cb()
          })
          .catch(cb)
      }))
      .on('error', reject)
      .on('finish', () => resolve({ count }))
  })
})

mongoose.model('ConsolidatedRecord', schema, collectionName)
