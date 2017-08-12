'use strict'

const mongoose = require('mongoose')
const { isNumber } = require('lodash')
const Promise = require('bluebird')

const ConsolidatedRecord = mongoose.model('ConsolidatedRecord')
const Catalog = mongoose.model('Catalog')


function consolidateRecords(req, res, next) {
  const reqLimit = parseInt(req.query.limit)
  const limit = isNumber(reqLimit) && reqLimit > 0 ? reqLimit : 100

  ConsolidatedRecord.consolidateMany({ limit })
    .then(({ count }) => res.status(202).send({ task: 'consolidate-records', count }))
    .catch(next)
}

function computeCatalogsMetrics(req, res, next) {
  let count

  Catalog.find().exec()
    .then(catalogs => {
      count = catalogs.length
      return Promise.map(catalogs, catalog => catalog.computeMetricsAndSave(), { concurrency: 5 })
    })
    .then(() => res.send({ task: 'compute-catalogs-metrics', count }))
    .catch(next)
}

module.exports = { consolidateRecords, computeCatalogsMetrics }
