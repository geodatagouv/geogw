/*eslint no-multi-spaces: 0, key-spacing: 0 */
const mongoose = require('mongoose');
const { Schema } = require('mongoose');
const sidekick = require('../helpers/sidekick');
const DistributionSchema = require('./schemas/distribution');
const { getHash } = require('../helpers/hash');
const moment = require('moment');
const t = require('through2');
const Promise = require('bluebird');

const ObjectId = Schema.Types.ObjectId;
const Mixed = Schema.Types.Mixed;


const collectionName = 'consolidated_records';

const FIELDS_TO_OMIT_IN_HASH = [
  'createdAt',
  'updatedAt',
  'consolidatedAt',
];

const schema = new Schema({

    hash: String,

    /* Identification */
    recordId:              { type: String,     required: true, unique: true },

    /* Attributes */
    recordHash:            { type: String,     required: true },
    revisionDate:          { type: Date },

    /* Catalogs */
    catalogs:             [{ type: ObjectId, ref: 'Service', index: true }],

    /* Publications */
    publications:         [Mixed],

    /* Content */
    metadata:              { type: Mixed },
    dataset: {
        distributions:     [DistributionSchema]
    },
    organizations:         { type: [String], index: true },
    alternateResources:    [Mixed],

    /* Facets */
    facets:                { type: [Mixed],   select: false },

    /* Dates */
    createdAt: { type: Date },
    updatedAt: { type: Date },
    consolidatedAt: { type: Date, index: true },
});

/* Indexes */
schema.index({ 'facets.name': 1, 'facets.value': 1 });

const textIndexOptions = {
    default_language: 'french',
    language_override: 'idioma', // To avoid conflict with `language` field of ISO-19139 JSON schema
    name: 'default_text_index',
    weights: {
        'metadata.title': 10,
        'metadata.keywords': 5,
        'metadata.abstract': 2
    }
};

const textIndexDefinition = {
    'metadata.title': 'text',
    'metadata.abstract': 'text',
    'metadata.keywords': 'text'
};

schema.index(textIndexDefinition, textIndexOptions);

schema.pre('save', function (next) {
  const hash = getHash(this.toObject(), { except: FIELDS_TO_OMIT_IN_HASH });
  const now = new Date();

  if (this.isNew) {
    this.set('createdAt', now);
  }

  if (this.hash && this.hash === hash) {
    FIELDS_TO_OMIT_IN_HASH.forEach(field => this.unmarkModified(field));
  } else {
    this.set('hash', hash);
    this.set('updatedAt', now);
  }

  this.set('consolidatedAt', now);
  next();
});

schema.method('isFresh', function (freshness = 3600) {
  return this.consolidatedAt && moment(this.consolidatedAt).add(freshness, 'seconds').isAfter();
});

/* Statics */

schema.static('triggerUpdated', function (recordId) {
  return sidekick('dataset:consolidate', { recordId });
});

schema.static('markAsOutdated', function (query = {}) {
  return this.update(query, { $set: { consolidatedAt: new Date(2000, 0) } }, { multi: true }).exec();
});

schema.static('consolidateMany', function ({ freshness = 3600, limit = 1000 }) {
  let count = 0;

  return new Promise((resolve, reject) => {
    this.find({ consolidatedAt: { $lt: moment().subtract(freshness, 'seconds').toDate() } })
      .select('recordId')
      .sort('consolidatedAt')
      .limit(limit)
      .lean()
      .cursor()
      .pipe(t.obj((record, enc, cb) => {
        return sidekick('dataset:consolidate', { recordId: record.recordId, freshness })
          .then(() => {
            count++;
            cb();
          })
          .catch(cb);
      }))
      .on('error', reject)
      .on('finish', () => resolve({ count }));
  });
});

mongoose.model('ConsolidatedRecord', schema, collectionName);
