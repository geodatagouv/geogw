const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
  recordId: { type: String, required: true },

  target: { type: String, required: true, index: true },
  remoteId: { type: String, required: true, index: true },
  remoteUrl: { type: String },

  createdAt: { type: Date },
  updatedAt: { type: Date },
});

schema.pre('save', function (next) {
  if (!this.createdAt) this.createdAt = new Date();
  this.updatedAt = new Date();
  next();
});

function reindexRecord(recordId) {
  return mongoose.model('ConsolidatedRecord').triggerUpdated(recordId).thenReturn();
}

schema.post('save', function (publication, next) {
  reindexRecord(publication.recordId).asCallback(next);
});

schema.post('remove', function (publication, next) {
  reindexRecord(publication.recordId).asCallback(next);
});

mongoose.model('Publication', schema);
