'use strict'

const { cleanURL, isPublicURL } = require('../../util/url')
const URI = require('urijs')
const { forEach, pick } = require('lodash')

class OnlineResource {

  constructor({ name, href, protocol, description }) {
    if (!href) throw new Error('location must be defined')
    this.name = name
    this.sourceLocation = cleanURL(href)
    this.sourceProtocol = protocol
    this.description = description

    if (!isPublicURL(this.sourceLocation)) {
      throw new Error('Given location must be publicly available')
    }

    this.location = new URI(this.sourceLocation)
    this.query = this.parseAndNormalizeQuery()
  }

  parseAndNormalizeQuery() {
    var query = {}

    // Ensure query string param names are lower-cased
    forEach(this.location.search(true), function (val, key) {
      query[key.toLowerCase()] = val
    })

    return query
  }

  isWfsFeatureType() {
    var sourceProtocolContainsWfs = (this.sourceProtocol || '').toLowerCase().indexOf('wfs') >= 0
    var sourceLocationIsWfsQuery = (this.query.service || '').toLowerCase() === 'wfs'
    const sourceLocationContainsWfs = (this.sourceLocation || '').toLowerCase().includes('wfs')

    var detectWfsProtocol = sourceProtocolContainsWfs || sourceLocationIsWfsQuery || sourceLocationContainsWfs

    // Ensure we drop well-formed query of other OGC protocols (e.g. WMS)
    if (('service' in this.query) && this.query.service.toLowerCase() !== 'wfs') return false

    if (!detectWfsProtocol) return false

    var typeNameInQuery = this.query.typename || this.query.typenames || this.query.layers
    var typeNameFromName = (sourceProtocolContainsWfs || sourceLocationIsWfsQuery) && this.name

    this.typeNameFound = typeNameInQuery || typeNameFromName

    return !!this.typeNameFound
  }

  getFeatureTypeName() {
    return this.typeNameFound
  }

  getNormalizedWfsServiceLocation() {
    var location = this.location.clone()
    // map is used by MapServer
    // port is used by Business Geographic proxy
    location.search(pick(this.query, 'map', 'port'))
    location.fragment('').normalize()
    return location.valueOf()
  }

  isWmsLayer() {
    var sourceProtocolContainsWms = (this.sourceProtocol || '').toLowerCase().indexOf('wms') >= 0
    var sourceLocationIsWmsQuery = (this.query.service || '').toLowerCase() === 'wms'

    var detectWmsProtocol = sourceProtocolContainsWms || sourceLocationIsWmsQuery

    return detectWmsProtocol
  }

}

function castLink({ name, href, protocol, description }) {
  try {
    const resource = new OnlineResource({ name, href, protocol, description })
    if (resource.isWfsFeatureType()) {
      return {
        serviceURL: resource.getNormalizedWfsServiceLocation(),
        typeName: resource.getFeatureTypeName(),
      }
    }
    if (resource.isWmsLayer()) {
      throw new Error('WMS layers are not supported yet')
    }
    return { name, href, description }
  } catch (err) {
    return {
      valid: false,
      reason: err.message,
    }
  }
}

module.exports = { castLink }
