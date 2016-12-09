const Promise = require('bluebird');
const search = require('./search');

function computeMetrics(catalogName) {
  if (!catalogName) return Promise.reject(new Error('catalogName is required'));

  return Promise.join(
    search({ resultParts: 'facets,count', type: 'dataset' }, catalogName),
    search({ resultParts: 'facets,count' }, catalogName),

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

      return metrics;
    }
  );
}

module.exports = computeMetrics;
