const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Mixed = Schema.Types.Mixed;
const ObjectId = Schema.Types.ObjectId;

const schema = new Schema({
  slug: { type: String, unique: true, sparse: true },

  name: { type: String, required: true },
  description: String,
  tags: { type: [String], index: true },

  homepage: String,

  featured: { type: Boolean, index: true, required: true, default: false },

  service: { type: ObjectId, ref: 'Service', required: true },

  metrics: Mixed,

  createdAt: Date,
  updatedAt: Date,
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
