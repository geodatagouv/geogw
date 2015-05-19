/*
** Module dependencies
*/
var mongoose = require('mongoose');
var async = require('async');
var Schema = mongoose.Schema;
var Job = require('../kue').Job;

/*
** ServiceSync schema
*/
var ServiceSyncSchema = new Schema({
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
ServiceSyncSchema.methods = {

    removeJob: function(done) {
        Job.get(this.jobId, function(err, job) {
            if (err) return done(err);
            job.remove(done);
        });
    },

    toggleSuccessful: function(itemsFound, done) {
        var serviceSync = this;

        function updateServiceSync(cb) {
            serviceSync.set({
                itemsFound: itemsFound,
                status: 'successful',
                finished: Date.now()
            }).save(cb);
        }

        function updateService(cb) {
            serviceSync.service.toggleSyncStatus('successful', cb);
        }

        async.parallel([updateServiceSync, updateService], done);
    },

    toggleError: function(done) {
        var serviceSync = this;

        function updateServiceSync(cb) {
            serviceSync.set({
                status: 'failed',
                finished: Date.now()
            }).save(cb);
        }

        function updateService(cb) {
            serviceSync.service.toggleSyncStatus('failed', cb);
        }

        async.parallel([updateServiceSync, updateService], done);
    }

};


/*
** Attach model
*/
mongoose.model('ServiceSync', ServiceSyncSchema);
