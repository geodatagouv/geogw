'use strict'

const { each } = require('mississippi')
const { inspect } = require('util')
const mongoose = require('mongoose')
const moment = require('moment')
const { omit } = require('lodash')
const csw = require('csw-client')
const stringify = require('json-stable-stringify')
const ServiceSyncJob = require('../../syncJob')
const hasha = require('hasha')

const RecordRevision = mongoose.model('RecordRevision')
const CatalogRecord = mongoose.model('CatalogRecord')


function getValidModifiedDate(date) {
  if (!date) return
  const parsedValue = moment(date, moment.ISO_8601)
  if (!parsedValue.isValid()) return
  if (!moment().isAfter(parsedValue)) return
  return parsedValue.toDate()
}

class CswHarvestJob extends ServiceSyncJob {

  async processRecord(record) {
    const { id, type, body } = record

    const ignore = (reason) => {
      this.ignored++

      if (!(reason in this.ignoreStats)) {
        this.ignoreStats[reason] = 1
      } else {
        this.ignoreStats[reason]++
      }

      if (reason === 'Identifier too short') {
        this.log('Record identifier too short: %s', id)
      } else if (reason === 'Identifier too long') {
        this.log('Record identifier too long: %s', id)
      } else if (reason === 'Not supported type') {
        this.log('Not supported record type: %s', type)
      }
    }

    const supportedTypes = {
      MD_Metadata: { modifiedKey: 'dateStamp' },
      Record: { modifiedKey: 'modified' },
    }

    if (!(type in supportedTypes)) return ignore('Not supported type')

    const typeOptions = supportedTypes[type]

    // Technical checks
    if (!id) return ignore('No identifier')
    if (id.length < 10) return ignore('Identifier too short')
    if (id.length > 255) return ignore('Identifier too long')

    // Augment record meta
    const hashedId = hasha(id, { algorithm: 'sha1' })
    const hash = hasha(stringify(omit(body, typeOptions.modifiedKey)), { algorithm: 'sha1' })
    const modified = getValidModifiedDate(record.body[typeOptions.modifiedKey])

    if (this.harvester.allStarted) this.progress(this.returned, this.harvester.matched)

    const catalogRecordRevision = {
      catalog: this.service,
      recordId: hashedId,
      recordHash: hash,
      recordType: type,
      revisionDate: modified,
      content: body,
    }

    try {
      await RecordRevision.upsert(catalogRecordRevision)
      await CatalogRecord.upsert(catalogRecordRevision)
      this.returned++
    } catch (err) {
      this.errored++
      this.log(inspect(err))
    }
  }

  _sync() {
    this.returned = 0
    this.ignored = 0
    this.errored = 0

    this.ignoreStats = {}

    const location = this.service.location
    const client = csw(location)

    const schema = location.includes('grandlyon') || location.includes('adour-garonne') ?
      'both' :
      'iso'

    this.harvester = client.harvest({ schema })

    this.harvester
      .once('started', () => this.log('Records matched: %d', this.harvester.matched))

    each(this.harvester, (record, next) => {
      this.processRecord(record)
      this.progress(this.progression / this.total)
      next()
    }, err => {
      this.log('Harvester report:')
      this.log(JSON.stringify(this.harvester, true, 2))
      if (err) {
        this.fail(err)
      } else {
        this.log('Unique records returned: %d', this.returned)
        this.log('Ignore statistics:')
        Object.keys(this.ignoreStats).forEach(ignoreReason => {
          this.log(`  * ${ignoreReason}: ${this.ignoreStats[ignoreReason]}`)
        })
        this.success(this.returned)
      }
    })
  }

}

exports.handler = function harvest({ data, log, progress }) {
  return (new CswHarvestJob({ data, log, progress }, { failsAfter: 600 })).exec()
}
