'use strict'

const { get } = require('lodash')
const { getUniformArray } = require('../common/util')

exports.getAllKeywords = function (metadata) {
  const candidateKeywords = [get(metadata, 'identificationInfo.topicCategory')]
  const descriptiveKeywords = get(metadata, 'identificationInfo.descriptiveKeywords') || []
  descriptiveKeywords.forEach(dk => candidateKeywords.push(dk.keyword))
  return getUniformArray(candidateKeywords)
}
