/* eslint indent: ['error', 2] */
const mongoose = require('mongoose');
const yaml = require('js-yaml');
const fs = require('fs');
const { indexBy } = require('lodash');
const search = require('../helpers/search');

const augmentedCatalogs = indexBy(yaml.safeLoad(fs.readFileSync(__dirname + '/../../data/catalogs.yml', 'utf8')), 'id');

const Service = mongoose.model('Service');

function formatCatalog(service) {
  const id = service._id;
  const augmentedCatalog = augmentedCatalogs[id] || {};

  const catalog = {
    id,
    name: augmentedCatalog.name || service.name,
    slug: augmentedCatalog.slug,
    tags: augmentedCatalog.tags || [],
    homepage: augmentedCatalog.homepage,
    serviceUrl: augmentedCatalog.serviceUrl || service.location,

    lastHarvesting: {
      status: service.sync.status,
      // duration: 1800
      recordsFound: service.sync.itemsFound,
      finishedAt: service.sync.finishedAt,
    }
  };

  return catalog;
}

function catalog(req, res, next, id) {
  Service
    .findOne({ protocol: 'csw', _id: new mongoose.Types.ObjectId(id) })
    .lean()
    .exec(function(err, service) {
      if (err) return next(err);
      if (!service) return res.sendStatus(404);
      req.catalog = formatCatalog(service);
      next();
    });
}

function show(req, res) {
  res.send(req.catalog);
}

function list(req, res, next) {
  Service
    .find({ protocol: 'csw' })
    .lean()
    .exec(function(err, services) {
      if (err) return next(err);
      res.send(services.map(formatCatalog));
    });
}

function metrics(req, res, next) {
  search({ limit: 1 }, req.catalog.name, function (err, result) {
    if (err) return next(err);
    const metrics = {
      totalCount: result.count,
      counts: {
        organizations: {},
        keywords: {},
      },
      partitions: {

      },
    };

    function handleFacetAsCount(facetName, countName) {
      if (result.facets[facetName]) {
        metrics.counts[countName] = {};
        result.facets[facetName].forEach(facet => {
          metrics.counts[countName][facet.value] = facet.count;
        });
      }
    }

    function handleFacetAsPartition(facetName, countName) {
      if (result.facets[facetName]) {
        metrics.partitions[countName] = {};
        result.facets[facetName].forEach(facet => {
          metrics.partitions[countName][facet.value] = facet.count;
        });
      }
    }

    handleFacetAsCount('organization', 'organizations');
    handleFacetAsCount('keyword', 'keywords');

    handleFacetAsPartition('type', 'recordType');
    handleFacetAsPartition('representationType', 'dataType');
    handleFacetAsPartition('opendata', 'openness');
    handleFacetAsPartition('availability', 'download');
    handleFacetAsPartition('license', 'license');

    res.send(metrics);
  });
}

module.exports = { catalog, list, show, metrics };
