'use strict'

const through2 = require('through2')
const { inspect } = require('util')
const mongoose = require('mongoose')
const ServiceSyncJob = require('../../syncJob')
const { Harvester } = require('./harvester')

const RecordRevision = mongoose.model('RecordRevision')
const CatalogRecord = mongoose.model('CatalogRecord')


class CswHarvestJob extends ServiceSyncJob {

  processRecord() {
    return through2.obj((record, enc, done) => {
      this.returned++
      if (this.harvester.allStarted) this.progress(this.returned, this.harvester.matched)

      const catalogRecordRevision = {
        catalog: this.service,
        recordId: record.hashedId,
        recordHash: record.hash,
        recordType: record.type,
        revisionDate: record.modified,
        content: record.body,
      }

      RecordRevision.upsert(catalogRecordRevision)
        .then(() => CatalogRecord.upsert(catalogRecordRevision))
        .nodeify(done)
    })
  }

  _sync() {
    this.returned = 0
    this.ignoreStats = {}

    const location = this.service.location

    const harvesterOptions = {
      dublinCoreFallback: location.includes('grandlyon') || location.includes('adour-garonne.eaufrance.fr'),
    }

    this.harvester = new Harvester(location, harvesterOptions)

    this.harvester
      .on('error', err => this.log(inspect(err)))
      .once('all-failed', () => this.fail(new Error('Harvesting has failed')))
      .once('started', () => this.log('Records matched: %d', this.harvester.matched))
      .on('ignore', ignoreResult => {
        if (!(ignoreResult.ignoreReason in this.ignoreStats)) {
          this.ignoreStats[ignoreResult.ignoreReason] = 0
        }

        if (ignoreResult.ignoreReason === 'Identifier too short') {
          this.log('Record identifier too short: %s', ignoreResult.id)
        } else if (ignoreResult.ignoreReason === 'Identifier too long') {
          this.log('Record identifier too long: %s', ignoreResult.id)
        } else if (ignoreResult.ignoreReason === 'Not supported type') {
          this.log('Not supported record type: %s', ignoreResult.type)
        }

        this.ignoreStats[ignoreResult.ignoreReason]++
        this.returned++
      })
      .pipe(this.processRecord())
      .on('end', () => {
        this.log('Unique records returned: %d', this.harvester.unique)
        this.log('Ignore statistics:')
        Object.keys(this.ignoreStats).forEach(ignoreReason => {
          this.log(`  * ${ignoreReason}: ${this.ignoreStats[ignoreReason]}`)
        })
        this.success(this.harvester.unique)
      })
      .resume()
  }

  _finish() {
    if (this.harvester) {
      this.harvester.unpipe()
      this.harvester.removeAllListeners()
      this.harvester = null
    }
  }

}

exports.handler = function harvest({ data, log, progress }) {
  return (new CswHarvestJob({ data, log, progress }, { failsAfter: 600 })).exec()
}
