'use strict'

const { format } = require('util')
const mongoose = require('mongoose')

const ServiceSync = mongoose.model('ServiceSync')


class ServiceSyncJob {

  constructor({ data, log, progress }, options) {
    this.options = options || {}
    this._log = log
    this._progress = progress
    this.data = data
  }

  exec() {
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

  fail(err) {
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

  success(count) {
    this.clearTimeout()

    this.serviceSync.toggleSuccessful(count, err => {
      if (err) console.log('Critical error: unable to persist success status on a serviceSync')
      this._resolve()
    })
  }

  log() {
    if (process.env.NODE_ENV === 'development') {
      console.log.apply(null, arguments)
    }
    this.serviceSync.log.push(format.apply(null, arguments))
    this._log.apply(null, arguments)
  }

  progress(progression) {
    this.touchTimeout()
    this._progress(progression)
  }

  touchTimeout() {
    this.clearTimeout()
    var job = this

    if (this.options.failsAfter) {
      this.failsAfterTimeout = setTimeout(function () {
        job.log('Synchronization timeout')
        job.fail(new Error('Synchronization timeout'))
      }, this.options.failsAfter * 1000)
    }
  }

  clearTimeout() {
    if (this.failsAfterTimeout) {
      clearTimeout(this.failsAfterTimeout)
    }
  }

}


module.exports = ServiceSyncJob
