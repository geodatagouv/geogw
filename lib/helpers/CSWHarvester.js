'use strict'

const EventEmitter = require('events').EventEmitter
const MultiStream = require('multistream')
const through = require('through2').obj
const csw = require('csw-client')
const { once, omit } = require('lodash')
const stringify = require('json-stable-stringify')
const debug = require('debug')('geogw:csw-harvester')
const sha1 = require('../helpers/hash').sha1
const moment = require('moment')

class Harvester extends EventEmitter {

  constructor(location, options = {}) {
    if (!location) throw new Error('location param is required')
    const { encodeQs, defineConstraintLanguage, defineNamespace, dublinCoreFallback } = options

    super()

    this.matched = 0
    this.failed = 0
    this.started = 0
    this.ignored = 0
    this.unique = 0

    const client = csw(location, {
      userAgent: 'CSWHarvester',
      concurrency: 5,
      encodeQs,
      gzip: false,
    })

    debug('new harvester for location: %s', location)

    client.on('request', req => debug('request %s', req.url.href))

    const harvestOptions = { defineConstraintLanguage, defineNamespace }

    const internalHarvesters = []

    const started = once(() => {
      this.emit('started')
    })

    const addHarvester = (harvester, name) => {
      harvester
        .once('started', () => {
          this.started++
          this.matched += harvester.matched
          this.emit('internal-harvester:started', { name, matched: harvester.matched })
          debug('started harvester %s', name)
          started()
          if (this.started === internalHarvesters.length) {
            this.allStarted = true
            this.emit('all-started')
          }
        })
        .once('failed', () => {
          this.failed++
          this.emit('internal-harvester:failed', { name })
          debug('harvester %s has failed', name)
          if (this.failed === internalHarvesters.length) {
            this.allFailed = true
            this.emit('all-failed')
          }
        })
        .on('pageError', err => {
          this.emit('internal-harvester:pageError', { name, err })
        })
      internalHarvesters.push(harvester)
    }

    addHarvester(client.harvest(Object.assign({ schema: 'inspire' }, harvestOptions)), 'inspire')

    if (dublinCoreFallback) {
      addHarvester(client.harvest(harvestOptions), 'dublin-core')
    }

    const recordIds = new Set()
    const ms = MultiStream(internalHarvesters, { objectMode: true })

    this.innerStream = ms.pipe(through((record, enc, cb) => {
      const ignore = (reason) => {
        record.ignoreReason = reason
        this.ignored++
        this.emit('ignore', record)
        cb()
      }

      const supportedTypes = {
        MD_Metadata: { modifiedKey: 'dateStamp', idKey: 'fileIdentifier' },
        Record: { modifiedKey: 'modified', idKey: 'identifier' },
      }

      if (!(record.type in supportedTypes)) return ignore('Not supported type')

      const typeOptions = supportedTypes[record.type]

      record.id = record.body[typeOptions.idKey]

      // Technical checks
      if (!record.id) return ignore('No identifier')
      if (record.id.length < 10) return ignore('Identifier too short')
      if (record.id.length > 255) return ignore('Identifier too long')
      if (recordIds.has(record.id)) return ignore('Record already seen')

      // Augment record meta
      record.hashedId = sha1(record.id)
      record.hash = sha1(stringify(omit(record.body, typeOptions.modifiedKey)))

      function getValidMomentDate(date) {
        if (!date) return
        const parsedValue = moment(date, moment.ISO_8601)
        if (parsedValue.isValid()) return parsedValue
      }

      const modified = getValidMomentDate(record.body[typeOptions.modifiedKey])
      if (modified && moment().isAfter(modified)) {
        record.modified = modified.toDate()
      } else {
        console.log('record modified date is in the future')
      }

      recordIds.add(record.id)
      this.unique++
      cb(null, record)
    }))

    ms.on('error', err => this.emit('error', err))

    this.innerStream.on('end', () => recordIds.clear())
  }

  pipe(target) {
    return this.innerStream.pipe(target)
  }

  unpipe(target) {
    return this.innerStream.unpipe(target)
  }

}

exports.Harvester = Harvester
