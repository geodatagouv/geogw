'use strict'

const { createHash } = require('crypto')
const stringify = require('json-stable-stringify')
const { pick, omit } = require('lodash')


function sha1(str) {
  return createHash('sha1').update(str, 'utf8').digest('hex')
}

function getHash(obj, options = {}) {
  let filteredObj = obj
  if (options.only) {
    filteredObj = pick(obj, ...options.only)
  } else if (options.except) {
    filteredObj = omit(obj, ...options.except)
  }
  return createHash('sha1').update(stringify(filteredObj), 'utf8').digest('hex')
}


module.exports = { sha1, getHash }
