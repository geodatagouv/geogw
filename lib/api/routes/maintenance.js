'use strict'

const { Router } = require('express')

const { consolidateRecords, computeCatalogsMetrics } = require('../controllers/maintenance')
const { isMaintenance } = require('./middlewares/auth')

module.exports = function (app) {
  const router = new Router()

  /* Routes */
  router.post('/consolidate-records', consolidateRecords)
  router.post('/compute-catalogs-metrics', computeCatalogsMetrics)

  app.use('/maintenance', isMaintenance, router)
}
