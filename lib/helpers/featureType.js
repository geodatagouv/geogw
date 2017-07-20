'use strict';

function normalizeFeatureTypeName(featureTypeName) {
  featureTypeName = featureTypeName.toLowerCase();
  const colonPosition = featureTypeName.indexOf(':');
  return colonPosition >= 0 ? featureTypeName.substr(colonPosition + 1) : featureTypeName;
}

module.exports = { normalizeFeatureTypeName };
