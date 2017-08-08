'use strict'

const { kebabCase } = require('lodash')

exports.getLicenseFromLinks = function (links) {
  let license
  links.forEach(link => {
    const lcName = (link.name || '').toLowerCase()
    if (lcName.includes('licence') && lcName.includes('ouverte')) {
      license = 'fr-lo'; return
    }
    if (lcName.includes('odbl')) {
      license = 'odc-odbl'; return
    }
  })
  return license
}

const openDataKeywords = [
  'donnee-ouverte',
  'donnees-ouvertes',
  'donnee-ouvertes',
  'donnees-ouverte',
  'opendata',
  'open-data',
]

exports.getLicenseFromKeywords = function (keywords) {
  keywords = keywords.map(kebabCase)
  let openness = false

  // Detect PRODIGE usual keywords
  openness = openness || (keywords.includes('grand-public') &&
        (keywords.includes('non-restreint') || keywords.includes('ouvert')))

  // Detect official keyword and variations (CNIG)
  openness = openness || keywords.find(k => openDataKeywords.includes(k))

  return openness ? 'fr-lo' : null
}

const catalogsKnownAsOpen = [
  '54f5a39a62781800bf6db9e6',
  '53a01c3c23a9836106440e0f',
  '560015bf7cb6bdf9d0422ae7',
]

exports.getLicenseFromCatalogs = function (catalogs) {
  const openness = catalogs.find(catalog => catalogsKnownAsOpen.includes(catalog._id.toString()))
  return openness ? 'fr-lo' : null
}
