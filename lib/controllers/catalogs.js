/* eslint indent: ['error', 2] */
const mongoose = require('mongoose');
const search = require('../helpers/search');
const Promise = require('bluebird');

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

const searchAsync = Promise.promisify(search);

function metrics(req, res, next) {
  Promise.join(
    searchAsync({ resultParts: 'facets,count', type: 'dataset' }, req.catalog.name),
    searchAsync({ resultParts: 'facets,count' }, req.catalog.name),

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

module.exports = { fetch, list, show, metrics };
