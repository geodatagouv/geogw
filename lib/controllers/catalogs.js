'use strict'

const mongoose = require('mongoose')
const { omit } = require('lodash')

const Catalog = mongoose.model('Catalog')

function formatCatalog(catalog) {
  return omit(catalog.toObject({ virtuals: true, minimize: false }), '_metrics')
}

function fetch(req, res, next, id) {
  Catalog
    .findById(id)
    .populate('service', 'location sync')
    .exec(function(err, catalog) {
      if (err) return next(err)
      if (!catalog) return res.sendStatus(404)
      req.catalog = catalog
      next()
    })
}

function show(req, res) {
  res.send(formatCatalog(req.catalog))
}

function list(req, res, next) {
  Catalog
    .find()
    .populate('service', 'location sync')
    .exec(function(err, catalogs) {
      if (err) return next(err)
      res.send(catalogs.map(formatCatalog))
    })
}

function metrics(req, res, next) {
  req.catalog.computeMetricsAndSave()
    .then(catalog => res.send(catalog.metrics))
    .catch(next)
}

function update(req, res, next) {
  if (req.body.name) {
    req.catalog.rename(req.body.name)
      .then(catalog => res.send(catalog))
      .catch(next)
  } else {
    res.send(req.catalog)
  }
}

function destroy(req, res, next) {
  req.catalog.deleteAndClean()
    .then(() => res.status(204).end())
    .catch(next)
}

module.exports = { fetch, list, show, metrics, destroy, update }
