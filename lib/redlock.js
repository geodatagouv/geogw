'use strict'

const Redlock = require('redlock')
const { port, host } = require('./config/redis')

const client = require('redis').createClient(port, host)
const redlock = new Redlock([client])

redlock.on('clientError', function (err) {
  console.error('A redis error has occurred:', err)
})

module.exports = redlock
