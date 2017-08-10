'use strict'

const tld = require('tldjs')
const ipaddr = require('ipaddr.js')
const URI = require('urijs')
const { trim } = require('lodash')

function cleanURL(string) {
  // Replace tabulations and line breaks by spaces
  string = string.replace(/(\r\n|\n|\r|\t)/gm, ' ')
  // Trim spaces and dashes
  string = trim(string, '- ')
  return string
}

function isPublicURL(location) {
  const urlObj = new URI(location)

  if (!urlObj.is('url') || urlObj.is('relative')) return false
  if (urlObj.protocol() !== 'http' && urlObj.protocol() !== 'https') return false
  if (!urlObj.is('ip') && !urlObj.is('name')) return false

  if (urlObj.is('ip')) {
    const addr = ipaddr.parse(urlObj.hostname())
    const range = addr.range()
    const rangesToExclude = [
      'unspecified',
      'broadcast',
      'multicast',
      'linkLocal',
      'loopback',
      'private',
      'reserved',
    ]
    if (range && rangesToExclude.includes(range)) return false
  }

  if (urlObj.is('name')) {
    if (!tld.tldExists(urlObj.hostname())) return false
    if (urlObj.hostname().endsWith('ader.gouv.fr')) return false
  }

  return true
}

module.exports = { cleanURL, isPublicURL }
