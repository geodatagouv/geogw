/*
** Module dependencies
*/
var _ = require('lodash');
var mongoose = require('../mongoose');

var ServiceSync = mongoose.model('ServiceSync');


/*
** Constructor
*/
function ServiceSyncJob(job) {
    this._job = job;
    this.data = job.data;
}


/*
** Methods
*/
ServiceSyncJob.prototype.start = function(executionDone) {
    this.executionCallback = executionDone;

    ServiceSync.findByIdAndProcess(this.data.serviceSyncId, this._job.id, _.bind(function(err, serviceSync) {
        if (err) {
            this.fail(err);
        } else if (!serviceSync) {
            this.fail(new Error('No related ServiceSync found!'));
        } else {
            this.serviceSync = serviceSync;
            this.id = serviceSync._id;
            this.service = serviceSync.service;
            this._sync();
        }
    }, this));
};

ServiceSyncJob.prototype.fail = function(err) {
    this.serviceSync.toggleError(_.bind(function(persistError) {
        if (persistError) console.log('Critical error: unable to persist error status on a serviceSync');
        this.executionCallback(err);
    }, this));
};

ServiceSyncJob.prototype.success = function(count) {
    this.serviceSync.toggleSuccessful(count, _.bind(function(err) {
        if (err) console.log('Critical error: unable to persist success status on a serviceSync');
        this.executionCallback();
    }, this));
};

ServiceSyncJob.prototype.log = function() {
    if (process.env.NODE_ENV === 'development') {
        console.log.apply(null, arguments);
    }
    this._job.log.apply(this._job, arguments);
};

ServiceSyncJob.prototype.progress = function() {
    this._job.progress.apply(this._job, arguments);
};


/*
** Exports
*/
module.exports = ServiceSyncJob;
