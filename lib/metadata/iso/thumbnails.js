'use strict'

const { checkUrl } = require('../../util/url')
const { sha1 } = require('../../util/hash')

exports.prepareThumbnails = function (graphicOverviews = []) {
  return graphicOverviews
    .map(go => ({
      originalUrl: go.fileName && go.fileName.trim(),
      description: go.fileDescription && go.fileDescription.trim(),
    }))
    .filter(thumbnail => thumbnail.originalUrl && checkUrl(thumbnail.originalUrl))
    .map(thumbnail => {
      thumbnail.originalUrlHash = sha1(thumbnail.originalUrl).substr(0, 7)
      return thumbnail
    })
}
