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
        async.parallel([
            function(cb) {
                serviceSync.set({
                    itemsFound: itemsFound,
                    status: 'successful',
                    finished: Date.now()
                }).save(cb);
            },
            function(cb) {
                serviceSync.service.set('lastSuccessfulSync', serviceSync._id).save(cb);
            }
        ], done);
    },

    toggleError: function(done) {
        this.set({
            status: 'failed',
            finished: Date.now()
        }).save(done);
    }

};

/*
** Static methods
*/
ServiceSyncSchema.statics = {

    findByIdAndProcess: function(id, jobId, done) {
        this
            .findById(id)
            .populate('service')
            .exec(function(err, serviceSync) {
                if (err) return done(err);
                if (!serviceSync) return done(new Error('Unable to fetch serviceSync ' + id));

                serviceSync.set({
                    status: 'processing',
                    started: Date.now(),
                    jobId: jobId
                }).save(done);
            });
    }

};

/*
** Attach model
*/
mongoose.model('ServiceSync', ServiceSyncSchema);
