'use strict'

const Redlock = require('redlock')
const { redisConfig, prefix } = require('../config/lock')

const client = require('redis').createClient(redisConfig.port, redisConfig.host)
const redlock = new Redlock([client])

redlock.on('clientError', function (err) {
  console.error('A redis error has occurred:', err)
})

function lock(resourceName, ttl) {
  return redlock.lock(`${prefix}:${resourceName}`, ttl)
}

module.exports = { lock }
