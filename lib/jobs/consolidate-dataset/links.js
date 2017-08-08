'use strict'

const { upsertLink, getLastLinkCheck } = require('../../linkAnalyzer')
const { OnlineResource } = require('../../metadata/iso/onlineResources')
const Promise = require('bluebird')
const { invert } = require('lodash')

async function fetchLinks(ids) {
  const fetchingLinks = ids.map(id => {
    return getLastLinkCheck(id)
      .catch(() => undefined)
  })
  const fetchedLinks = await Promise.all(fetchingLinks)
  const indexedLinks = {}
  fetchedLinks.forEach(fetchedLink => {
    if (!fetchedLink) return
    indexedLinks[fetchedLink.linkId] = fetchedLink
  })
  return indexedLinks
}

async function resolveLinks(record) {
  const rawLinks = record.metadata.links
    .filter(rawLink => {
      try {
        const resource = new OnlineResource(rawLink)
        return !resource.isWfsFeatureType() && !resource.isWmsLayer()
      } catch (err) {
        // TODO Handle errors
        return false
      }
    })

  const rawLinksHref = rawLinks.map(rawLink => rawLink.href)

  const mapping = record.links.mapping || {}

  // Clean links mapping
  for (let id in mapping) {
    if (!rawLinksHref.includes(mapping[id])) {
      mapping[id] = undefined
    }
  }

  // Add upsert new links to analyzer
  const knownLinks = Object.values(mapping)
  const unknownLinks = rawLinksHref.filter(linkHref => !knownLinks.includes(linkHref))
  const upsertingLinks = unknownLinks.map(unknownLink => {
    return upsertLink(unknownLink).catch(() => undefined) // TODO Handle errors
  })

  const upsertedLinks = await Promise.all(upsertingLinks)

  upsertedLinks.forEach(upsertedLink => {
    if (upsertedLink) {
      mapping[upsertedLink._id] = upsertedLink.location
    } else {
      // TODO Handle errors
    }
  })

  const invertedMapping = invert(mapping)
  const ids = Object.keys(mapping)
  const fetchedLinksByIds = await fetchLinks(ids)
  const resources = []

  // Populate resources array with analyzed links
  rawLinks.forEach(rawLink => {
    if (!invertedMapping[rawLink.href] || !fetchedLinksByIds[invertedMapping[rawLink.href]]) {
      // TODO Improve error detection
      resources.push({
        name: rawLink.name,
        location: rawLink.href,
        type: 'error',
      })
    } else if (!fetchedLinksByIds[invertedMapping[rawLink.href]].result) {
      // TODO Improve error detection
      resources.push({
        name: rawLink.name,
        location: rawLink.href,
        type: 'not-analyzed-yet',
      })
    } else {
      const analyzedLink = fetchedLinksByIds[invertedMapping[rawLink.href]]
      if (['file-distribution', 'unknown-archive'].includes(analyzedLink.result.type)) {
        if (analyzedLink.result.archive && analyzedLink.result.archive.datasets.length > 0) {
          analyzedLink.result.archive.datasets.forEach(dataset => {
            resources.push({
              type: 'file-package',
              name: `${rawLink.name} (${dataset})`,
              location: rawLink.href,
              hashedLocation: analyzedLink.linkId,
              available: analyzedLink.result.available,
              layer: dataset,
              uniqueId: analyzedLink.linkId + '@@' + dataset,
            })
          })
        } else {
          resources.push({
            type: 'file-package',
            originalDistribution: true,
            name: rawLink.name,
            location: rawLink.href,
            hashedLocation: analyzedLink.linkId,
            available: analyzedLink.result.available,
          })
        }
      } else {
        resources.push({
          name: rawLink.name,
          location: rawLink.href,
          type: 'page',
        })
      }
    }
  })

  record.linksResources = resources

  return record
    .set('links.mapping', mapping)
    .set('links.ids', ids)
}

module.exports = { resolveLinks }
