'use strict'

const Redlock = require('redlock')

const client = require('redis').createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST
)

const redlock = new Redlock([client])

redlock.on('clientError', function (err) {
  console.error('A redis error has occurred:', err)
})

module.exports = redlock
