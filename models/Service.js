'use strict'

const mongoose = require('mongoose')
const { Schema } = require('mongoose')
const { pick, keyBy } = require('lodash')
const { enqueue } = require('../lib/jobs')
const Promise = require('bluebird')

const supportedProtocols = keyBy([
  { name: 'csw', syncTask: 'harvest-csw' },
  { name: 'wfs', syncTask: 'lookup-wfs' },
], 'name')

const SYNC_STATUSES = ['new', 'successful', 'failed']

const schema = new Schema({

  location: { type: String, required: true },
  protocol: { type: String, enum: Object.keys(supportedProtocols), required: true },

  /* Context */
  name: { type: String, trim: true },
  abstract: { type: String },
  keywords: { type: [String] },

  /* Synchronization */
  sync: {
    status: { type: String, enum: SYNC_STATUSES, index: true, required: true },
    pending: { type: Boolean },
    processing: { type: Boolean },
    itemsFound: { type: Number },
    finishedAt: { type: Date, index: true },
  },

  syncEnabled: { type: Boolean, default: true },
})


/*
** Statics
*/
schema.statics = {

  setAsPending: function (uniqueQuery) {
    const query = Object.assign({
      syncEnabled: true,
      'sync.pending': false,
      'sync.processing': false,
    }, uniqueQuery)

    const changes = {
      $set: { 'sync.pending': true },
    }

    return this.update(query, changes).exec().then(rawResponse => rawResponse.nModified === 1)
  },

  triggerSync: function (uniqueQuery, freshness = 0) {
    let syncTask
    let service

    return this.findOne(uniqueQuery).exec()
      .then(foundService => {
        if (!foundService) throw new Error('service not found for query: ' + JSON.stringify(uniqueQuery))
        service = foundService
        syncTask = supportedProtocols[service.protocol].syncTask
        return service
      })
      .then(service => {
        // Pre-check part should be moved into the sync task
        const minFinishedAtAcceptable = new Date(Date.now() - freshness)

        if (service.sync && service.sync.finishedAt && service.sync.finishedAt > minFinishedAtAcceptable) {
          return 'ignored' // fresh
        }

        return this.setAsPending(uniqueQuery)
          .then(ok => ok ? 'ready' : 'ignored')
      })
      .then(status => {
        if (status === 'ready') {
          return Promise.resolve()
            .then(() => mongoose.model('ServiceSync').create({ service: service._id, status: 'queued' }))
            .then(() => enqueue(
              syncTask,
              { serviceId: service._id, freshness }
            ))
            .return('queued')
        }
        return status
      })
  },

  upsert: function (service) {
    if (!service.protocol) throw new Error('protocol is not defined')
    if (!service.location) throw new Error('location is not defined')

    const query = pick(service, 'location', 'protocol')

    const changes = {
      $setOnInsert: {
        syncEnabled: true,
        sync: {
          status: 'new',
          processing: false,
          pending: false,
          finishedAt: new Date(1970),
        },
      },
    }

    return this.update(query, changes, { upsert: true }).exec()
      .then(rawResponse => {
        if (rawResponse.upserted) {
          return this.triggerSync(query).return('created')
        } else {
          return this.triggerSync(query, 2 * 60 * 60 * 1000).return('updated') // 2 hours
        }
      })
  },

}


/*
** Methods
*/
schema.methods.doSync = function(freshness) {
  return mongoose.model('Service').triggerSync({ _id: this._id }, freshness)
}

schema.methods.toggleSyncStatus = function (status, itemsFound = 0) {
  return this
    .set('sync.status', status)
    .set('sync.pending', false)
    .set('sync.processing', false)
    .set('sync.finishedAt', new Date())
    .set('sync.itemsFound', itemsFound || 0)
    .save()
}


const collectionName = 'services'

const model = mongoose.model('Service', schema, collectionName)

module.exports = { model, collectionName, schema }
