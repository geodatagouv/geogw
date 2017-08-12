'use strict'

const { pick } = require('lodash')
const URI = require('urijs')
const { parse } = require('querystring')

function getNormalizedWfsServiceLocation(location) {
  location = new URI(location)
  const query = parse(location.query())
  // map is used by MapServer
  // port is used by Business Geographic proxy
  location.search(pick(query, 'map', 'port'))
  location.fragment('').normalize()
  return location.valueOf()
}

module.exports = { getNormalizedWfsServiceLocation }
