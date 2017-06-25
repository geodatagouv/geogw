const mongoose = require('mongoose');
const { Schema } = mongoose;
const Promise = require('bluebird');


const schema = new Schema({
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    jobId: Number,
    status: { type: String, enum: ['queued', 'processing', 'successful', 'failed'], required: true },
    statusMessage: String,
    progress: Number,
    itemsFound: Number,
    started: Date,
    finished: Date,
    log: [String]
});

/*
** Methods
*/
schema.methods = {

    toggleSuccessful: function(itemsFound, done) {
      const updateServiceSyncPromise = this.set({
        itemsFound: itemsFound,
        status: 'successful',
        finished: Date.now()
      }).save();

      const updateServicePromise = this.service.toggleSyncStatus('successful', itemsFound);

      return Promise.all([updateServiceSyncPromise, updateServicePromise]).asCallback(done);
    },

    toggleError: function(done) {
      const updateServiceSyncPromise = this.set({
        status: 'failed',
        finished: Date.now()
      }).save();

      const updateServicePromise = this.service.toggleSyncStatus('failed');

      return Promise.all([updateServiceSyncPromise, updateServicePromise]).asCallback(done);
    }

};


mongoose.model('ServiceSync', schema);
