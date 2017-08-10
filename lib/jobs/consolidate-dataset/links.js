'use strict'

const { upsertLink, getLastLinkCheck } = require('../../linkAnalyzer')
const { OnlineResource } = require('../../metadata/iso/onlineResources')
const Promise = require('bluebird')
const { clone, keyBy } = require('lodash')

async function withCheckResult(link) {
  const withCheckResultLink = clone(link)
  try {
    const check = await getLastLinkCheck(link.id)
    if (check.result) withCheckResultLink.checkResult = check.result
  } catch (err) {
    console.error('Unable to fetch last link check for link %s', link.id)
  }
  return withCheckResultLink
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

  const links = (record._links || [])
    .filter(link => rawLinksHref.includes(link.href)) // Drop obsolete links

  // Add upsert new links to analyzer
  const knownLinks = links.map(link => link.href)
  const unknownLinks = rawLinksHref.filter(linkHref => !knownLinks.includes(linkHref))
  const upsertingLinks = unknownLinks.map(unknownLink => {
    return upsertLink(unknownLink).catch(() => undefined) // TODO Handle errors
  })

  const upsertedLinks = await Promise.all(upsertingLinks)

  upsertedLinks.forEach(upsertedLink => {
    if (upsertedLink) {
      links.push({
        id: upsertedLink._id,
        href: upsertedLink.location,
      })
    } else {
      // TODO Handle errors
    }
  })

  const withCheckResultLinks = await Promise.all(links.map(withCheckResult))
  const indexedLinks = keyBy(withCheckResultLinks, 'href')

  const resources = []

  // Populate resources array with analyzed links
  rawLinks.forEach(rawLink => {
    if (!indexedLinks[rawLink]) {
      // TODO Improve error detection
      resources.push({
        name: rawLink.name,
        location: rawLink.href,
        type: 'error',
      })
    } else if (!indexedLinks[rawLink].checkResult) {
      // TODO Improve error detection
      resources.push({
        name: rawLink.name,
        location: rawLink.href,
        type: 'not-analyzed-yet',
      })
    } else {
      const analyzedLink = indexedLinks[rawLink]
      if (['file-distribution', 'unknown-archive'].includes(analyzedLink.checkResult.type)) {
        if (analyzedLink.checkResult.archive && analyzedLink.checkResult.archive.datasets.length > 0) {
          analyzedLink.checkResult.archive.datasets.forEach(dataset => {
            resources.push({
              type: 'file-package',
              name: `${rawLink.name} (${dataset})`,
              location: rawLink.href,
              hashedLocation: analyzedLink.id,
              available: analyzedLink.checkResult.available,
              layer: dataset,
              uniqueId: analyzedLink.id + '@@' + dataset,
            })
          })
        } else {
          resources.push({
            type: 'file-package',
            originalDistribution: true,
            name: rawLink.name,
            location: rawLink.href,
            hashedLocation: analyzedLink.id,
            available: analyzedLink.checkResult.available,
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
    .set('_links', links)
}

module.exports = { resolveLinks }
