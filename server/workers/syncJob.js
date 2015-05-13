/*
** Module dependencies
*/
var _ = require('lodash');
var util = require('util');
var mongoose = require('../mongoose');

var ServiceSync = mongoose.model('ServiceSync');


/*
** Constructor
*/
function ServiceSyncJob(job, options) {
    this.options = options || {};
    this._job = job;
    this.data = job.data;
}


/*
** Methods
*/
ServiceSyncJob.prototype.start = function(executionDone) {
    this.executionCallback = _.once(executionDone);
    this.touchTimeout();

    ServiceSync
        .findOne({ service: this.data.serviceId, status: 'queued' })
        .populate('service')
        .exec(_.bind(function(err, serviceSync) {
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
    this.clearTimeout();
    if (this._finish) this._finish();

    this.serviceSync.toggleError(_.bind(function(persistError) {
        if (persistError) {
            console.log('Critical error: unable to persist error status on a serviceSync');
            console.trace(persistError);
        }
        this.executionCallback(err);
    }, this));
};

ServiceSyncJob.prototype.success = function(count) {
    this.clearTimeout();

    this.serviceSync.toggleSuccessful(count, _.bind(function(err) {
        if (err) console.log('Critical error: unable to persist success status on a serviceSync');
        this.executionCallback();
    }, this));
};

ServiceSyncJob.prototype.log = function() {
    if (process.env.NODE_ENV === 'development') {
        console.log.apply(null, arguments);
    }
    this.serviceSync.log.push(util.format.apply(null, arguments));
    this._job.log.apply(this._job, arguments);
};

ServiceSyncJob.prototype.progress = function() {
    this.touchTimeout();
    this._job.progress.apply(this._job, arguments);
};

ServiceSyncJob.prototype.touchTimeout = function () {
    this.clearTimeout();
    var job = this;

    if (this.options.failsAfter) {
        this.failsAfterTimeout = setTimeout(function () {
            job.log('Synchronization timeout');
            job.fail(new Error('Synchronization timeout'));
        }, this.options.failsAfter * 1000);
    }
};

ServiceSyncJob.prototype.clearTimeout = function () {
    if (this.failsAfterTimeout) {
        clearTimeout(this.failsAfterTimeout);
    }
};


/*
** Exports
*/
module.exports = ServiceSyncJob;
