'use strict'

const { checkUrl } = require('../../util/url')
const hasha = require('hasha')

exports.prepareThumbnails = function (graphicOverviews = []) {
  return graphicOverviews
    .map(go => ({
      originalUrl: go.fileName && go.fileName.trim(),
      description: go.fileDescription && go.fileDescription.trim(),
    }))
    .filter(thumbnail => thumbnail.originalUrl && checkUrl(thumbnail.originalUrl))
    .map(thumbnail => {
      thumbnail.originalUrlHash = hasha(thumbnail.originalUrl, { algorithm: 'sha1' }).substr(0, 7)
      return thumbnail
    })
}
