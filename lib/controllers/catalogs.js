/* eslint indent: ['error', 2] */
const mongoose = require('mongoose');
const yaml = require('js-yaml');
const fs = require('fs');
const { indexBy } = require('lodash');
const search = require('../helpers/search');
const Promise = require('bluebird');

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

const searchAsync = Promise.promisify(search);

function metrics(req, res, next) {
  Promise.join(
    searchAsync({ limit: 1, type: 'dataset' }, req.catalog.name),
    searchAsync({ limit: 1,  }, req.catalog.name),

    function (datasetsResult, recordsResult) {
      const metrics = {
        records: {
          totalCount: recordsResult.count,
          counts: {
            organizations: {},
            keywords: {},
          },
          partitions: {},
        },
        datasets: {
          totalCount: datasetsResult.count,
          partitions: {}
        },
      };

      function handleFacetAsCount(facetName, countName, resultObj, type) {
        if (resultObj.facets[facetName]) {
          metrics[type].counts[countName] = {};
          resultObj.facets[facetName].forEach(facet => {
            metrics[type].counts[countName][facet.value] = facet.count;
          });
        }
      }

      function handleFacetAsPartition(facetName, countName, resultObj, type) {
        if (resultObj.facets[facetName]) {
          metrics[type].partitions[countName] = {};
          resultObj.facets[facetName].forEach(facet => {
            metrics[type].partitions[countName][facet.value] = facet.count;
          });
        }
      }

      handleFacetAsCount('organization', 'organizations', recordsResult, 'records');
      handleFacetAsCount('keyword', 'keywords', recordsResult, 'records');
      // handleFacetAsCount('distributionFormat', 'distributionFormats');

      handleFacetAsPartition('type', 'recordType', recordsResult, 'records');
      handleFacetAsPartition('representationType', 'dataType', datasetsResult, 'datasets');
      handleFacetAsPartition('opendata', 'openness', datasetsResult, 'datasets');
      handleFacetAsPartition('availability', 'download', datasetsResult, 'datasets');
      handleFacetAsPartition('metadataType', 'metadataType', recordsResult, 'records');

      res.send(metrics);
    }
  ).catch(next);
}

module.exports = { catalog, list, show, metrics };
