/*
** Module dependencies
*/
var mongoose = require('mongoose');
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
    }

};

/*
** Attach model
*/
mongoose.model('ServiceSync', ServiceSyncSchema);
