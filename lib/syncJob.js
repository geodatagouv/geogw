'use strict'

var util = require('util')
var mongoose = require('mongoose')

var ServiceSync = mongoose.model('ServiceSync')


/*
** Constructor
*/
function ServiceSyncJob({ data, log, progress }, options) {
  this.options = options || {}
  this._log = log
  this._progress = progress
  this.data = data
}


/*
** Methods
*/
ServiceSyncJob.prototype.exec = function() {
  return new Promise((resolve, reject) => {
    this._resolve = resolve
    this._reject = reject
    this.touchTimeout()

    ServiceSync
      .findOne({ service: this.data.serviceId, status: 'queued' })
      .populate('service')
      .exec((err, serviceSync) => {
        if (err) {
          this.fail(err)
        } else if (!serviceSync) {
          this.fail(new Error('No related ServiceSync found!'))
        } else {
          this.serviceSync = serviceSync
          this.id = serviceSync._id
          this.service = serviceSync.service
          this._sync()
        }
      })
  })
}

ServiceSyncJob.prototype.fail = function(err) {
  this.clearTimeout()
  if (this._finish) this._finish()
  if (this.serviceSync) {
    this.serviceSync.toggleError(persistError => {
      if (persistError) {
        console.log('Critical error: unable to persist error status on a serviceSync')
        console.trace(persistError)
      }
    })
  }
  this._reject(err)
}

ServiceSyncJob.prototype.success = function(count) {
  this.clearTimeout()

  this.serviceSync.toggleSuccessful(count, err => {
    if (err) console.log('Critical error: unable to persist success status on a serviceSync')
    this._resolve()
  })
}

ServiceSyncJob.prototype.log = function() {
  if (process.env.NODE_ENV === 'development') {
    console.log.apply(null, arguments)
  }
  this.serviceSync.log.push(util.format.apply(null, arguments))
  this._log.apply(null, arguments)
}

ServiceSyncJob.prototype.progress = function() {
  this.touchTimeout()
  this._progress.apply(null, arguments)
}

ServiceSyncJob.prototype.touchTimeout = function () {
  this.clearTimeout()
  var job = this

  if (this.options.failsAfter) {
    this.failsAfterTimeout = setTimeout(function () {
      job.log('Synchronization timeout')
      job.fail(new Error('Synchronization timeout'))
    }, this.options.failsAfter * 1000)
  }
}

ServiceSyncJob.prototype.clearTimeout = function () {
  if (this.failsAfterTimeout) {
    clearTimeout(this.failsAfterTimeout)
  }
}


/*
** Exports
*/
module.exports = ServiceSyncJob
