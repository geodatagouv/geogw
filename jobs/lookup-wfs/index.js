'use strict'

const wfs = require('wfs-client')
const Promise = require('bluebird')

const mongoose = require('mongoose')

const ServiceSyncJob = require('../syncJob')

const RelatedResource = mongoose.model('RelatedResource')
const FeatureType = mongoose.model('FeatureType')
const Record = mongoose.model('ConsolidatedRecord')

function filterValidFeatureTypes(featureTypes = []) {
  return featureTypes.filter(ft => ft.name && ft.name.length > 0)
}

class WfsLookupJob extends ServiceSyncJob {

  getCapabilities() {
    const client = wfs(this.service.location, {
      userAgent: 'WFSHarvester',
      timeout: 25,
    })
    return client.capabilities()
  }

  getRelatedRecords() {
    return RelatedResource.distinct('record', {
      'featureType.matchingService': this.service._id,
    }).exec()
  }

  propagateChanges() {
    return Promise.map(this.getRelatedRecords(), recordId => Record.triggerUpdated(recordId, 'feature types updated'))
  }

  saveFeatureTypes(featureTypes) {
    return Promise.each(featureTypes, ft => FeatureType.upsert(this.service._id, ft))
      .then(() => FeatureType.markAllAsUnavailable(this.service._id, featureTypes))
  }

  updateMetadata(capabilities) {
    const { abstract, keywords } = capabilities.service
    const name = capabilities.service.title

    return this.service
      .set({ name, abstract, keywords })
      .save()
  }

  _sync() {
    let featureTypesFound = 0

    this.getCapabilities()
      .then(capabilities => {
        const featureTypes = filterValidFeatureTypes(capabilities.featureTypes)
        featureTypesFound = featureTypes.length
        return Promise.resolve(this.updateMetadata(capabilities))
          .thenReturn(featureTypes)
      }, () => {
        // When error...
        return []
      })
      .then(featureTypes => this.saveFeatureTypes(featureTypes))
      .then(() => this.propagateChanges())
      .then(() => this.success(featureTypesFound))
      .catch(err => this.fail(err))
  }

}


/*
** Exports
*/
exports.handler = function({ data, log, progress }) {
  return (new WfsLookupJob({ data, log, progress }, { failsAfter: 60 })).exec()
}
