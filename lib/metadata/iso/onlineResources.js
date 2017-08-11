'use strict'

const { getUniformArray } = require('../common/util')
const { get } = require('lodash')

function getAllOnLineResources(metadata) {
  const candidateLinks = []
  const transferOptions = get(metadata, 'distributionInfo.transferOptions') || []
  transferOptions.forEach(to => (to.onLine || []).forEach(resource => candidateLinks.push(resource)))
  return getUniformArray(candidateLinks)
}

module.exports = { getAllOnLineResources }
