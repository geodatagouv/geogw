const mongoose = require('mongoose');
const computeMetrics = require('../helpers/computeMetrics');

const Catalog = mongoose.model('Catalog');

function fetch(req, res, next, id) {
  Catalog
    .findById(id)
    .populate('service', 'location sync')
    .exec(function(err, catalog) {
      if (err) return next(err);
      if (!catalog) return res.sendStatus(404);
      req.catalog = catalog;
      next();
    });
}

function show(req, res) {
  res.send(req.catalog);
}

function list(req, res, next) {
  Catalog
    .find()
    .populate('service', 'location sync')
    .exec(function(err, catalogs) {
      if (err) return next(err);
      res.send(catalogs);
    });
}

function metrics(req, res, next) {
  req.catalog.computeMetricsAndSave()
    .then(catalog => res.send(catalog.metrics))
    .catch(next);
}

module.exports = { fetch, list, show, metrics };
