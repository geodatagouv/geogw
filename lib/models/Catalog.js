const mongoose = require('mongoose');
const computeMetrics = require('../helpers/computeMetrics');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const Promise = require('bluebird');

const schema = new Schema({
  slug: { type: String, unique: true, sparse: true },

  name: { type: String, required: true },
  description: String,
  tags: { type: [String], index: true },

  homepage: String,

  featured: { type: Boolean, index: true, required: true, default: false },

  service: { type: ObjectId, ref: 'Service', required: true },

  _metrics: String,

  createdAt: Date,
  updatedAt: Date,
});

schema.virtual('metrics').get(function () {
  if (!this._metrics) return;
  return JSON.parse(this._metrics);
});

schema.method('computeMetricsAndSave', function () {
  return computeMetrics(this)
    .then(metrics => this.set('_metrics', JSON.stringify(metrics)))
    .then(() => this.save());
});

schema.method('mostRecentRevisionDate', function () {
  const CatalogRecord = mongoose.model('CatalogRecord');

  return CatalogRecord.find({ catalog: this._id, revisionDate: { $exists: true } })
    .sort('-revisionDate')
    .limit(1)
    .lean()
    .exec()
    .then(mostRecentCatalogRecord => {
      if (mostRecentCatalogRecord.length > 0) return mostRecentCatalogRecord[0].revisionDate;
    });
});

schema.method('markRecordsAsOutdated', function () {
  return mongoose
    .model('ConsolidatedRecord')
    .markAsOutdated({ catalogs: this._id });
});

schema.method('deleteAndClean', function () {
  const Service = mongoose.model('Service');
  const CatalogRecord = mongoose.model('CatalogRecord');
  const ServiceSync = mongoose.model('ServiceSync');

  return Promise.all([
    Service.remove({ _id: this._id }),
    ServiceSync.remove({ service: this._id }),
    CatalogRecord.remove({ catalog: this._id }),
  ])
  .then(() => this.remove())
  .then(() => this.markRecordsAsOutdated())
  .thenReturn(this);
});

schema.method('rename', function (name) {
  if (!name) throw new Error('name is required');
  if (name === this.name) return Promise.resolve(this);

  return mongoose.model('Service').update({ _id: this._id }, { $set: { name } }).exec()
    .then(() => this.set({ name }).save())
    .then(() => this.markRecordsAsOutdated())
    .thenReturn(this);
});

schema.pre('save', function (next) {
  const now = new Date();

  if (this.isNew) {
    if (!this.isInit('createdAt')) this.set('createdAt', now);
  }
  if (this.isModified()) this.set('updatedAt', now);
  next();
});

mongoose.model('Catalog', schema);
